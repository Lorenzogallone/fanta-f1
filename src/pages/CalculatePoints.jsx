/**
 * @file CalculatePoints.jsx
 * @description Admin panel for calculating race and championship points
 * Handles both race results entry and points calculation with automatic F1 API fetching
 */

import React, { useEffect, useState } from "react";
import {
  Card, Form, Button, Alert, Spinner, Container,
  Row, Col, Badge, Tab, Nav, Table
} from "react-bootstrap";
import {
  collection, query, orderBy, getDocs,
  doc, setDoc, getDoc, Timestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { isLastRace, calculatePointsForRace } from "../services/pointsCalculator";
import { calculateChampionshipPoints } from "../services/championshipPointsCalculator";
import { saveRankingSnapshot } from "../services/rankingSnapshot";
import { fetchRaceResults } from "../services/f1ResultsFetcher";
import { DRIVERS, CONSTRUCTORS, DRIVER_TEAM, TEAM_LOGOS, POINTS } from "../constants/racing";
import RaceHistoryCard from "../components/RaceHistoryCard";
import AdminLogin from "../components/AdminLogin";
import Select from "react-select";
import { useLanguage } from "../contexts/LanguageContext";
import "../styles/customSelect.css";

// Constants imported from centralized file
const drivers = DRIVERS;
const constructors = CONSTRUCTORS;
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;
const PTS_MAIN = POINTS.MAIN;
const PTS_SPRINT = POINTS.SPRINT;
const BONUS_JOLLY_MAIN = POINTS.BONUS_JOLLY_MAIN;
const BONUS_JOLLY_SPRINT = POINTS.BONUS_JOLLY_SPRINT;

/**
 * Deadline status badge component
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether deadline is open
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Status badge
 */
const DeadlineBadge = ({ open, t }) => (
  <Badge bg={open ? "success" : "danger"}>
    {open ? ` ${t("calculate.ready")} ` : ` ${t("calculate.locked")} `}
  </Badge>
);

/**
 * Double points indicator badge
 * @param {Object} props - Component props
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Double points badge
 */
const DoubleBadge = ({ t }) => (
  <Badge bg="warning" text="dark">{t("calculate.doublePoints")}</Badge>
);

/**
 * Helper to create driver option with logo
 * @param {string} d - Driver name
 * @returns {Object} Select option with logo
 */
const asDriverOpt = d => ({
  value: d,
  label: (
    <div className="select-option">
      <img src={teamLogos[driverTeam[d]]} className="option-logo" alt={driverTeam[d]} />
      <span className="option-text">{d}</span>
    </div>
  ),
});
/**
 * Helper to create constructor option with logo
 * @param {string} c - Constructor name
 * @returns {Object} Select option with logo
 */
const asConstructorOpt = c => ({
  value: c,
  label: (
    <div className="select-option">
      <img src={teamLogos[c]} className="option-logo" alt={c} />
      <span className="option-text">{c}</span>
    </div>
  ),
});
const driverOptions      = drivers.map(asDriverOpt);
const constructorOptions = constructors.map(asConstructorOpt);

/**
 * Component to display driver name with team logo
 * @param {Object} props - Component props
 * @param {string} props.name - Driver name
 * @returns {JSX.Element} Driver name with logo
 */
const DriverWithLogo = ({ name }) => {
  if (!name) return <>—</>;
  const team = driverTeam[name];
  return (
    <span className="d-flex align-items-center">
      {team && (
        <img
          src={teamLogos[team]}
          alt={team}
          style={{ height: 18, width: 18, objectFit: "contain", marginRight: 4 }}
        />
      )}
      {name}
    </span>
  );
};

/**
 * Main points calculation component with tabs for race and championship
 * @returns {JSX.Element} Points calculation interface
 */
function CalculatePointsContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("race");

  // Race state
  const [races, setRaces] = useState([]);
  const [race,  setRace]  = useState(null);
  const [loadingRace, setLoadingRace] = useState(true);
  const [savingRace,  setSavingRace]  = useState(false);
  const [msgRace,     setMsgRace]     = useState(null);
  const [fetchingResults, setFetchingResults] = useState(false);

  const [formRace, setFormRace] = useState({
    P1:null,P2:null,P3:null, SP1:null,SP2:null,SP3:null
  });

  // Preview state
  const [official,  setOfficial]   = useState(null);
  const [subs,      setSubs]       = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [rankingMap,setRankingMap] = useState({});
  const [errSubs,   setErrSubs]    = useState(null);

  // Championship state
  const [formChamp,setFormChamp]   = useState({
    CP1:null,CP2:null,CP3:null, CC1:null,CC2:null,CC3:null
  });
  const [savingChamp,setSavingChamp]=useState(false);
  const [msgChamp,setMsgChamp]     = useState(null);

  /**
   * Load race list (selects first race not yet calculated)
   */
useEffect(() => {
  (async () => {
    try {
      // Load all races ordered by date
      const snap = await getDocs(
        query(collection(db, "races"), orderBy("raceUTC", "asc"))
      );

      // Complete list
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRaces(list);

      // Default = first race in list
      if (list.length) setRace(list[0]);
    } catch (err) {
      console.error(err);
      setMsgRace({ variant: "danger", msg: t("calculate.errorLoadingRaces") });
    } finally {
      setLoadingRace(false);
    }
  })();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  /**
   * Load preview data (submissions and official results)
   */
  useEffect(()=>{
    if(!race) return;
    (async()=>{
      setLoadingSubs(true); setErrSubs(null);
      try{
        // Load user mapping once
        if(!Object.keys(rankingMap).length){
          const mapSnap = await getDocs(collection(db,"ranking"));
          const map={}; mapSnap.docs.forEach(d=>{map[d.id]=d.data().name;});
          setRankingMap(map);
        }
        // Official results
        const rDoc = await getDoc(doc(db,"races",race.id));
        setOfficial(rDoc.data().officialResults ?? null);
        // Submissions
        const sSnap= await getDocs(collection(db,"races",race.id,"submissions"));
        const arr  = sSnap.docs.map(d=>({id:d.id,...d.data()}));
        arr.sort((a,b)=>(
          (a.user||rankingMap[a.id]||a.id).localeCompare(
          (b.user||rankingMap[b.id]||b.id),"it")
        ));
        setSubs(arr);
      // eslint-disable-next-line no-unused-vars
      }catch(e){ setErrSubs(t("calculate.errorLoadingSubmissions")); }
      finally   { setLoadingSubs(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[race]);

  // Race submission validation helpers
  const nowMS = Date.now();
  const allowedRace = race && nowMS > race.raceUTC.seconds*1000 + 90*60*1000;
  const mainFilled  = formRace.P1&&formRace.P2&&formRace.P3;
  const hasSprint   = Boolean(race?.qualiSprintUTC);
  const sprintFilled= !hasSprint || (formRace.SP1&&formRace.SP2&&formRace.SP3);
  const isLast      = isLastRace(races,race?.id);
  const canSubmitRace = allowedRace && mainFilled && sprintFilled && !savingRace;
  const onSelRace = (sel,f)=>setFormRace(s=>({...s,[f]:sel}));

/**
 * Auto-fetch race results from F1 API when race changes
 */
useEffect(() => {
  if (!race) return;

  (async () => {
    setFetchingResults(true);
    setMsgRace(null);

    // Read race document from database
    const snap = await getDoc(doc(db, "races", race.id));
    const off  = snap.exists() ? snap.data().officialResults ?? null : null;
    setOfficial(off);

    // Helper to convert driver name to select option
    const toOpt = name =>
      name
        ? driverOptions.find(o => o.value === name) || { value: name, label: name }
        : null;

    // If official results exist in DB, use them
    if (off) {
      setFormRace({
        P1 : toOpt(off.P1),
        P2 : toOpt(off.P2),
        P3 : toOpt(off.P3),
        SP1: toOpt(off.SP1),
        SP2: toOpt(off.SP2),
        SP3: toOpt(off.SP3),
      });
      setFetchingResults(false);
    } else {
      // No results in DB → try fetching from API
      try {
        // Extract season and round from race date
        const raceDate = new Date(race.raceUTC.seconds * 1000);
        const season = raceDate.getFullYear();
        const round = race.round;

        setMsgRace({variant:"info", msg: t("calculate.fetchingFromAPI", { race: race.name }).replace("{race}", race.name)});

        const apiResults = await fetchRaceResults(season, round);

        if (apiResults) {
          // Pre-fill with API results
          setFormRace({
            P1 : toOpt(apiResults.main.P1),
            P2 : toOpt(apiResults.main.P2),
            P3 : toOpt(apiResults.main.P3),
            SP1: apiResults.sprint ? toOpt(apiResults.sprint.SP1) : null,
            SP2: apiResults.sprint ? toOpt(apiResults.sprint.SP2) : null,
            SP3: apiResults.sprint ? toOpt(apiResults.sprint.SP3) : null,
          });
          setMsgRace({
            variant:"success",
            msg: t("calculate.apiResultsLoaded")
          });
        } else {
          // No results available in DB or API
          setFormRace({
            P1:null, P2:null, P3:null,
            SP1:null, SP2:null, SP3:null
          });
          setMsgRace({
            variant:"warning",
            msg: t("calculate.apiNoResults")
          });
        }
      } catch (error) {
        console.error("Errore fetch API:", error);
        setFormRace({
          P1:null, P2:null, P3:null,
          SP1:null, SP2:null, SP3:null
        });
        setMsgRace({
          variant:"warning",
          msg: t("calculate.apiError")
        });
      } finally {
        setFetchingResults(false);
      }
    }

    // Load submissions
    const subSnap = await getDocs(
      collection(db, "races", race.id, "submissions")
    );
    const arr = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setSubs(arr);
    setLoadingSubs(false);
  })().catch(err => {
    console.error(err);
    setErrSubs(t("calculate.errorLoadingSubmissions"));
    setLoadingSubs(false);
    setFetchingResults(false);
  });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [race]);

  const saveRace = async e=>{
    e.preventDefault(); if(!canSubmitRace) return;
    setSavingRace(true); setMsgRace(null);
    try{
      await setDoc(doc(db,"races",race.id),{
        officialResults:{
          P1:formRace.P1.value,P2:formRace.P2.value,P3:formRace.P3.value,
          SP1:formRace.SP1?.value||null,SP2:formRace.SP2?.value||null,SP3:formRace.SP3?.value||null,
          doublePoints:isLast,savedAt:Timestamp.now()
        }},{merge:true});
      setMsgRace({variant:"info",msg: t("calculate.resultsSaved")});
      const res = await calculatePointsForRace(race.id);
      await setDoc(
        doc(db, "races", race.id),
        { pointsCalculated: true },
        { merge: true }
      );
      // Salva snapshot della classifica dopo il calcolo
      await saveRankingSnapshot("race", race.id);
      setMsgRace({variant:"success",msg:res});
      setFormRace({P1:null,P2:null,P3:null,SP1:null,SP2:null,SP3:null});
      /* refresh preview */
      const rDoc = await getDoc(doc(db,"races",race.id));
      setOfficial(rDoc.data().officialResults ?? null);
      const sSnap= await getDocs(collection(db,"races",race.id,"submissions"));
      setSubs(sSnap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(err){
      console.error(err);
      setMsgRace({variant:"danger",msg: t("calculate.saveError")});
    }finally{ setSavingRace(false); }
  };

  /* ---------------- HANDLERS CAMPIONATO -------------- */
  const onSelChamp = (sel,f)=>setFormChamp(s=>({...s,[f]:sel}));
  const lastRaceUTCms = races.length ? Math.max(...races.map(r=>r.raceUTC.seconds*1000)) : 0;
  const championshipOpen = nowMS > lastRaceUTCms;
  const champReady = championshipOpen && Object.values(formChamp).every(Boolean) && !savingChamp;

  const saveChamp = async e=>{
    e.preventDefault(); if(!champReady) return;
    setSavingChamp(true); setMsgChamp(null);
    try{
      await setDoc(doc(db,"championship","results"),{
        P1:formChamp.CP1.value,P2:formChamp.CP2.value,P3:formChamp.CP3.value,
        C1:formChamp.CC1.value,C2:formChamp.CC2.value,C3:formChamp.CC3.value,
        savedAt:Timestamp.now()
      },{merge:true});
      setMsgChamp({variant:"info",msg: t("calculate.resultsSaved")});
      // La funzione legge i risultati da Firestore (appena salvati sopra)
      const res = await calculateChampionshipPoints();
      // Salva snapshot della classifica dopo il calcolo del campionato
      await saveRankingSnapshot("championship", null);
      setMsgChamp({variant:"success",msg:res});
    }catch(err){
      console.error(err);
      setMsgChamp({variant:"danger",msg: t("calculate.saveError")});
    }finally{ setSavingChamp(false); }
  };

  /* ---------------- FUNZIONI PUNTI ------------------- */
  const calcMainPts = s=>{
    if(!official) return null;
    let pts=0;
    if (!s.mainP1 && !s.mainP2 && !s.mainP3) return -3;
    if(s.mainP1===official.P1) pts+=PTS_MAIN[1];
    if(s.mainP2===official.P2) pts+=PTS_MAIN[2];
    if(s.mainP3===official.P3) pts+=PTS_MAIN[3];
    if(s.mainJolly && [official.P1,official.P2,official.P3].includes(s.mainJolly))
      pts+=BONUS_JOLLY_MAIN;
    if(s.mainJolly2&& [official.P1,official.P2,official.P3].includes(s.mainJolly2))
      pts+=BONUS_JOLLY_MAIN;
    return pts;
  };
  const calcSprintPts = s=>{
    if(!official?.SP1) return null;
    if (!s.sprintP1 && !s.sprintP2 && !s.sprintP3) return -3;
    let pts=0;
    if(s.sprintP1===official.SP1) pts+=PTS_SPRINT[1];
    if(s.sprintP2===official.SP2) pts+=PTS_SPRINT[2];
    if(s.sprintP3===official.SP3) pts+=PTS_SPRINT[3];
    if(s.sprintJolly&&[official.SP1,official.SP2,official.SP3].includes(s.sprintJolly))
      pts+=BONUS_JOLLY_SPRINT;
    return pts;
  };
  const badge = v=><Badge bg={v>0?"success":"secondary"} pill>{v}</Badge>;

  /* ---------------- RENDER --------------------------- */
  if(loadingRace)
    return(<Container className="py-5 text-center"><Spinner animation="border"/></Container>);

  return (
    <Container className="py-4">
      <Tab.Container activeKey={activeTab} onSelect={k=>setActiveTab(k)}>
        <Nav variant="tabs" className="justify-content-center mb-4">
          <Nav.Item><Nav.Link eventKey="race">{t("calculate.raceTab")}</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="champ">{t("calculate.championshipTab")}</Nav.Link></Nav.Item>
        </Nav>

        <Tab.Content>
          {/* --------- TAB GARA --------- */}
          <Tab.Pane eventKey="race">
            <Row className="justify-content-center g-4">
              {/* ---------- FORM ---------- */}
              {/* … (form identico a prima – vedi sopra) … */}
<Col xs={12} lg={8}>
                <Card className="shadow">
                  <Card.Header className="bg-white d-flex justify-content-between">
                    <h5 className="mb-0">
                      {t("calculate.calculateRacePoints")} <DeadlineBadge open={allowedRace} t={t} />
                    </h5>
                    {isLast && <DoubleBadge t={t} />}
                  </Card.Header>
                  <Card.Body>
                    {msgRace && (
                      <Alert variant={msgRace.variant} onClose={()=>setMsgRace(null)} dismissible>
                        {msgRace.msg}
                      </Alert>
                    )}

                    {/* selezione gara */}
                    <Form.Group className="mb-4">
                      <Form.Label>{t("calculate.race")}</Form.Label>
                      <Form.Select
                        value={race?.id||""}
                        onChange={e => {
                             const r = races.find(x => x.id === e.target.value);
                             setRace(r);            // il nuovo effect imposterà il form
                           }}
                      >
                        {races.map(r=>(
                          <option key={r.id} value={r.id}>
                            {r.round}. {r.name} – {new Date(r.raceUTC.seconds*1000).toLocaleDateString()}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    {/* podio principale */}
                    <h6 className="fw-bold">{t("calculate.mainRace")}</h6>
                    {["P1","P2","P3"].map(f=>(
                      <Form.Group key={f} className="mb-3">
                        <Form.Label>{f}</Form.Label>
                        <Select
                          options={driverOptions}
                          value={formRace[f]}
                          onChange={sel=>onSelRace(sel,f)}
                          isDisabled={!allowedRace}
                          classNamePrefix="react-select"
                        />
                      </Form.Group>
                    ))}

                    {/* sprint */}
                    {race?.qualiSprintUTC && (
                      <>
                        <h6 className="fw-bold mt-3">{t("calculate.sprint")}</h6>
                        {["SP1","SP2","SP3"].map(f=>(
                          <Form.Group key={f} className="mb-3">
                            <Form.Label>{f}</Form.Label>
                            <Select
                              options={driverOptions}
                              value={formRace[f]}
                              onChange={sel=>onSelRace(sel,f)}
                              isDisabled={!allowedRace}
                              classNamePrefix="react-select"
                            />
                          </Form.Group>
                        ))}
                      </>
                    )}

                    <Button
                      variant="danger" className="w-100 mt-3"
                      onClick={saveRace} disabled={!canSubmitRace}
                    >
                      {savingRace ? t("common.loading") : t("calculate.calculateAndSave")}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
              {/* ---------- PREVIEW ---------- */}
              <Col xs={12} lg={10}>
                {race && <RaceHistoryCard race={race} showPoints={true} />}
              </Col>
            </Row>
          </Tab.Pane>

          {/* --------- TAB CAMPIONATO (identico) --------- */}
          <Tab.Pane eventKey="champ">
            {/* sezione campionato invariata */}
            {/* … usa formChamp / saveChamp / msgChamp … */}
            <Row className="justify-content-center">
              <Col xs={12} lg={8}>
                <Card className="shadow border-danger">
                  <Card.Header className="bg-white text-center">
                    <h5 className="mb-0">{t("calculate.calculateChampionshipPoints")}</h5>
                  </Card.Header>
                  <Card.Body>
                    {!championshipOpen && (
                      <Alert variant="warning" className="text-center">
                        {t("calculate.championshipAvailableAfterEnd")}
                      </Alert>
                    )}
                    {msgChamp && (
                      <Alert variant={msgChamp.variant} onClose={()=>setMsgChamp(null)} dismissible>
                        {msgChamp.msg}
                      </Alert>
                    )}

                    <Form onSubmit={saveChamp}>
                      <h6 className="fw-bold">{t("calculate.drivers")}</h6>
                      {["CP1","CP2","CP3"].map(f=>(
                        <Form.Group key={f} className="mb-3">
                          <Form.Label>{f.replace("CP","P")}</Form.Label>
                          <Select
                            options={driverOptions}
                            value={formChamp[f]}
                            onChange={sel=>onSelChamp(sel,f)}
                            isDisabled={!championshipOpen}
                            classNamePrefix="react-select"
                          />
                        </Form.Group>
                      ))}

                      <h6 className="fw-bold mt-3">{t("calculate.constructors")}</h6>
                      {["CC1","CC2","CC3"].map(f=>(
                        <Form.Group key={f} className="mb-3">
                          <Form.Label>{f.replace("CC","C")}</Form.Label>
                          <Select
                            options={constructorOptions}
                            value={formChamp[f]}
                            onChange={sel=>onSelChamp(sel,f)}
                            isDisabled={!championshipOpen}
                            classNamePrefix="react-select"
                          />
                        </Form.Group>
                      ))}

                      <Button
                        variant="danger" type="submit" className="w-100 mt-3"
                        disabled={!champReady}
                      >
                        {savingChamp ? t("common.loading") : t("calculate.calculateChampionshipPoints")}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}

/* ==================== WRAPPER CON PROTEZIONE ==================== */
export default function CalculatePoints() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Controlla se già autenticato
    const auth = localStorage.getItem("adminAuth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={() => setIsAuthenticated(true)} useLocalStorage={true} />;
  }

  return <CalculatePointsContent />;
}