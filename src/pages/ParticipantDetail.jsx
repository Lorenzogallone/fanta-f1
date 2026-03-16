/**
 * @file ParticipantDetail.jsx
 * @description Detailed participant profile page showing race history, statistics, and formations
 */

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Spinner,
  Alert,
  Button,
} from "react-bootstrap";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { error as logError } from "../utils/logger";
import { getChampionshipDeadlineMs } from "../utils/championshipDeadline";
import { getChampionshipStatistics } from "../services/statisticsService";
import PlayerStatsView from "../components/PlayerStatsView";

/**
 * Participant detail page showing complete user profile and statistics
 * @returns {JSX.Element} Participant detail page
 */
export default function ParticipantDetail() {
  const { userId } = useParams();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [participant, setParticipant] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [raceHistory, setRaceHistory] = useState([]);
  const [loadingParticipant, setLoadingParticipant] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [totalCompletedRaces, setTotalCompletedRaces] = useState(0);
  const [participantPosition, setParticipantPosition] = useState(null);
  const [championshipDeadlinePassed, setChampionshipDeadlinePassed] = useState(false);
  const [positionData, setPositionData] = useState([]);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  /**
   * Load participant data and race history with progressive loading
   */
  useEffect(() => {
    (async () => {
      try {
        // Load participant basic info from ranking, user profile, and deadline in parallel
        const [rankingDoc, profileDoc, deadlineMs] = await Promise.all([
          getDoc(doc(db, "ranking", userId)),
          getDoc(doc(db, "users", userId)),
          getChampionshipDeadlineMs(),
        ]);

        if (!rankingDoc.exists()) {
          setError(t("participantDetail.notFound"));
          setLoadingParticipant(false);
          setLoadingHistory(false);
          return;
        }

        const userData = rankingDoc.data();

        // Store user profile data
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setUserProfile({
            firstName: profileData.firstName || "",
            lastName: profileData.lastName || "",
            photoURL: profileData.photoURL || "",
          });
        }

        // Check championship deadline
        const deadlinePassed = deadlineMs ? Date.now() > deadlineMs : false;
        setChampionshipDeadlinePassed(deadlinePassed);

        // Load all participants to calculate position
        const allParticipantsSnap = await getDocs(collection(db, "ranking"));
        const ranking = allParticipantsSnap.docs
          .map(doc => ({
            userId: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => (b.puntiTotali || 0) - (a.puntiTotali || 0));

        // Calculate position with pari merito (tied positions)
        let currentPos = 1;
        let foundPosition = null;
        for (let i = 0; i < ranking.length; i++) {
          if (i > 0 && (ranking[i].puntiTotali || 0) < (ranking[i - 1].puntiTotali || 0)) {
            currentPos = i + 1;
          }
          if (ranking[i].userId === userId) {
            foundPosition = currentPos;
            break;
          }
        }
        setParticipantPosition(foundPosition);

        // Hide championship data if deadline hasn't passed and viewing another user
        const isOwnProfile = user?.uid === userId;
        const showChampionship = deadlinePassed || isOwnProfile;

        setParticipant({
          userId,
          name: userData.name,
          puntiTotali: userData.puntiTotali || 0,
          jolly: userData.jolly ?? 0,
          championshipPiloti: showChampionship ? (userData.championshipPiloti || []) : [],
          championshipCostruttori: showChampionship ? (userData.championshipCostruttori || []) : [],
          championshipPts: showChampionship ? (userData.championshipPts || 0) : 0,
        });
        setLoadingParticipant(false); // Show participant info immediately

        // Load all past races
        const now = Timestamp.now();
        const racesSnap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", "<", now),
            orderBy("raceUTC", "desc")
          )
        );

        setTotalCompletedRaces(racesSnap.size);

        // OPTIMIZED: Load submissions for all races IN PARALLEL
        const submissionsPromises = racesSnap.docs.map(async (raceDoc) => {
          const raceData = raceDoc.data();

          // Only include races with official results
          if (!raceData.officialResults) {
            return null;
          }

          try {
            const submissionDoc = await getDoc(
              doc(db, "races", raceDoc.id, "submissions", userId)
            );

            // Include race even if no submission (to show missing submissions)
            return {
              raceId: raceDoc.id,
              raceName: raceData.name,
              round: raceData.round,
              raceUTC: raceData.raceUTC,
              submission: submissionDoc.exists() ? submissionDoc.data() : null,
              officialResults: raceData.officialResults,
              cancelledSprint: raceData.cancelledSprint || false,
              cancelledMain: raceData.cancelledMain || false,
            };
          } catch (err) {
            logError(`Error fetching submission for race ${raceDoc.id}:`, err);
            return null;
          }
        });

        // Wait for all submissions to load in parallel
        const allSubmissions = await Promise.all(submissionsPromises);
        const history = allSubmissions.filter(Boolean); // Remove null entries (races without official results)

        setRaceHistory(history);

        // Load championship position history for the chart (background)
        try {
          const stats = await getChampionshipStatistics();
          const userHistory = stats.playersData[userId];
          if (userHistory) {
            setPositionData(
              userHistory
                .filter(d => d.position !== undefined)
                .map(d => ({
                  round: d.raceRound,
                  name: d.raceName,
                  position: d.position,
                }))
            );
          }
        } catch (err) {
          logError("Error loading position history:", err);
        }
      } catch (e) {
        logError("Error loading participant:", e);
        setError(t("errors.generic"));
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [userId, t, user?.uid]);

  // Show error if participant not found
  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button variant="secondary" onClick={() => window.history.back()}>
          {t("common.back")}
        </Button>
      </Container>
    );
  }

  // Show spinner only while loading participant basic info
  if (loadingParticipant) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">{t("common.loading")}</p>
      </Container>
    );
  }

  // Show loading for race history
  if (loadingHistory) {
    return (
      <Container className="py-5">
        <PlayerStatsView
          playerData={{
            name: participant?.name,
            totalPoints: participant?.puntiTotali || 0,
            position: participantPosition,
            jolly: participant?.jolly ?? 0,
            championshipPiloti: participant?.championshipPiloti || [],
            championshipCostruttori: participant?.championshipCostruttori || [],
            championshipPts: participant?.championshipPts || 0,
          }}
          firstName={userProfile?.firstName}
          lastName={userProfile?.lastName}
          photoURL={userProfile?.photoURL}
          raceHistory={[]}
          totalCompletedRaces={totalCompletedRaces}
          showCharts={false}
          showBackButton={true}
          positionData={positionData}
        />
        <div className="text-center mt-4">
          <Spinner animation="border" size="sm" style={{ color: accentColor }} />
          <p className="mt-3 text-muted">{t("participantDetail.loadingHistory")}</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <PlayerStatsView
        playerData={{
          name: participant?.name,
          totalPoints: participant?.puntiTotali || 0,
          position: participantPosition,
          jolly: participant?.jolly ?? 0,
          championshipPiloti: participant?.championshipPiloti || [],
          championshipCostruttori: participant?.championshipCostruttori || [],
          championshipPts: participant?.championshipPts || 0,
        }}
        firstName={userProfile?.firstName}
        lastName={userProfile?.lastName}
        photoURL={userProfile?.photoURL}
        raceHistory={raceHistory}
        totalCompletedRaces={totalCompletedRaces}
        showCharts={true}
        showBackButton={true}
        positionData={positionData}
      />
    </Container>
  );
}
