/**
 * @file ParticipantDetail.jsx
 * @description Detailed participant profile page showing race history, statistics, and formations
 */

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Container, Alert, Button } from "react-bootstrap";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { useWarm } from "../hooks/useWarm";
import { loadParticipant, loadStatistics, participantKey } from "../services/warmup";
import { error as logError } from "../utils/logger";
import PlayerStatsView from "../components/PlayerStatsView";
import AccountPanel from "../components/AccountPanel";
import LogoLoader from "../components/LogoLoader";

/**
 * Participant detail page showing complete user profile and statistics
 * @returns {JSX.Element} Participant detail page
 */
export default function ParticipantDetail() {
  const { userId } = useParams();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [error, setError] = useState(null);

  // Player data from the warm-up cache (the user's own page is loaded before
  // the splash goes away), refreshed in the background
  const data = useWarm(participantKey(userId, user?.uid));
  const stats = useWarm("statistics");
  useEffect(() => {
    loadParticipant(userId, user?.uid, true).catch((e) => {
      logError("Error loading participant:", e);
      setError(t("errors.generic"));
    });
    loadStatistics(true).catch((e) => logError("Error loading position history:", e));
  }, [userId, user?.uid, t]);

  useEffect(() => {
    if (data?.notFound) setError(t("participantDetail.notFound"));
  }, [data, t]);

  const loadingParticipant = data == null;
  const loadingHistory = data == null;
  const participant = data?.participant ?? null;
  const userProfile = data?.userProfile ?? null;
  const raceHistory = data?.raceHistory ?? [];
  const totalCompletedRaces = data?.totalCompletedRaces ?? 0;
  const participantPosition = data?.participantPosition ?? null;

  // Championship position history for the chart
  const positionData = useMemo(() => {
    const userHistory = stats?.playersData?.[userId];
    if (!userHistory) return [];
    return userHistory
      .filter((d) => d.position !== undefined)
      .map((d) => ({
        round: d.raceRound,
        label: d.raceLabel,
        name: d.isChampionship ? t("statistics.championshipStep") : d.raceName,
        position: d.position,
      }));
  }, [stats, userId, t]);

  const isOwnPage = user?.uid === userId;

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
        <LogoLoader label={t("common.loading")} />
      </Container>
    );
  }

  return (
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
      loadingHistory={loadingHistory}
      showCharts={!loadingHistory}
      showBackButton={!isOwnPage}
      accountPanel={isOwnPage ? <AccountPanel /> : null}
      positionData={positionData}
      pointsByRace={participant?.pointsByRace}
    />
  );
}
