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
import PlayerStatsView from "../components/PlayerStatsView";

/**
 * Participant detail page showing complete user profile and statistics
 * @returns {JSX.Element} Participant detail page
 */
export default function ParticipantDetail() {
  const { userId } = useParams();
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const [participant, setParticipant] = useState(null);
  const [raceHistory, setRaceHistory] = useState([]);
  const [loadingParticipant, setLoadingParticipant] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [totalCompletedRaces, setTotalCompletedRaces] = useState(0);
  const [participantPosition, setParticipantPosition] = useState(null);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  /**
   * Load participant data and race history with progressive loading
   */
  useEffect(() => {
    (async () => {
      try {
        // Load participant basic info from ranking - show immediately
        const userDoc = await getDoc(doc(db, "ranking", userId));
        if (!userDoc.exists()) {
          setError(t("participantDetail.notFound"));
          setLoadingParticipant(false);
          setLoadingHistory(false);
          return;
        }

        const userData = userDoc.data();

        // Load all participants to calculate position
        const allParticipantsSnap = await getDocs(collection(db, "ranking"));
        const ranking = allParticipantsSnap.docs
          .map(doc => ({
            userId: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => (b.puntiTotali || 0) - (a.puntiTotali || 0));

        const position = ranking.findIndex(p => p.userId === userId) + 1;
        setParticipantPosition(position > 0 ? position : null);

        setParticipant({
          userId,
          name: userData.name,
          puntiTotali: userData.puntiTotali || 0,
          jolly: userData.jolly ?? 0,
          championshipPiloti: userData.championshipPiloti || [],
          championshipCostruttori: userData.championshipCostruttori || [],
          championshipPts: userData.championshipPts || 0,
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
            console.error(`Error fetching submission for race ${raceDoc.id}:`, err);
            return null;
          }
        });

        // Wait for all submissions to load in parallel
        const allSubmissions = await Promise.all(submissionsPromises);
        const history = allSubmissions.filter(Boolean); // Remove null entries (races without official results)

        setRaceHistory(history);
      } catch (e) {
        console.error("Error loading participant:", e);
        setError(t("errors.generic"));
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [userId, t]);

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
          raceHistory={[]}
          totalCompletedRaces={totalCompletedRaces}
          showCharts={false}
          showBackButton={true}
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
        raceHistory={raceHistory}
        totalCompletedRaces={totalCompletedRaces}
        showCharts={true}
        showBackButton={true}
      />
    </Container>
  );
}
