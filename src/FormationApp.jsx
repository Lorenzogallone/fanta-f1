// src/FormationApp.jsx – look & feel "light paddock" with logos in dropdown
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Badge,
} from "react-bootstrap";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  increment,
  Timestamp,
} from "firebase/firestore";
import Select from "react-select";
import { db } from "./firebase";
import RaceHistoryCard from "./components/RaceHistoryCard";
import { DRIVERS, DRIVER_TEAM, TEAM_LOGOS } from "./constants/racing";
import "./customSelect.css";

/* --- costanti importate da file centralizzato ---------------------- */
const drivers = DRIVERS;
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

const driverOpts = drivers.map((d) => ({
  value: d,
  label: (
    <div className="select-option">
      <img src={teamLogos[driverTeam[d]]} className="option-logo" alt={driverTeam[d]} />
      <span className="option-text">{d}</span>
    </div>
  ),
}));

/* ─────────────────────────────────── COMPONENTE ──────────────────────────────────── */
export default function FormationApp() {
  /* ----- stato principale ----- */
  const [ranking, setRanking]   = useState([]);
  const [races,   setRaces]     = useState([]);
  const [race,    setRace]      = useState(null);

  const [busy,  setBusy]  = useState(true);
  const [permError, setPermError] = useState(false);
  const [flash, setFlash] = useState(null);

  const [savingMode, setSavingMode] = useState/** @type{"main"|"sprint"|null} */(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [userJolly, setUserJolly] = useState(0);
  const [form, setForm] = useState({
    userId:"", raceId:"",
    P1:null,P2:null,P3:null, jolly:null, jolly2:null,
    sprintP1:null,sprintP2:null,sprintP3:null,sprintJolly:null,
  });
  const [isEditMode, setIsEditMode] = useState(false);

  /* ─────────────── live ranking + prossime gare ─────────────── */
  useEffect(() => {
    (async () => {
      try {
        const unSub = onSnapshot(
          query(collection(db,"ranking"), orderBy("puntiTotali","desc")),
          snap => {
            const list = snap.docs.map(d=>({id:d.id, ...d.data(), jolly:d.data().jolly??0}));
            setRanking(list);
            if (form.userId) {
              const me = list.find(u=>u.id===form.userId);
              setUserJolly(me?.jolly ?? 0);
            }
          }
        );

        const rsnap = await getDocs(
          query(
            collection(db,"races"),
            where("raceUTC",">", Timestamp.now()),
            orderBy("raceUTC","asc")
          )
        );
        const future = rsnap.docs.map(d=>({id:d.id, ...d.data()}));
        setRaces(future);
        if (future.length) {
          setRace(future[0]);
          setForm(f=>({...f, raceId: future[0].id}));
        }
        return () => unSub();
      } catch (e) {
        console.error(e);
        if (e.code==="permission-denied") setPermError(true);
      } finally { setBusy(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────────── helpers di stato gara / sprint ─────────────── */
  const now          = Date.now();
  const qualiMs      = race?.qualiUTC.seconds*1000;
  const sprMs        = race?.qualiSprintUTC?.seconds*1000;
  const mainOpen     = race && now < qualiMs;
  const sprOpen      = race?.qualiSprintUTC && now < sprMs;
  const isSprintRace = Boolean(race?.qualiSprintUTC);

  const fullMain = form.P1 && form.P2 && form.P3 && form.jolly;
  const fullSpr  = form.sprintP1 && form.sprintP2 && form.sprintP3 && form.sprintJolly;

  const disabledMain   = !(form.userId && form.raceId && mainOpen && fullMain);
  const disabledSprint = !(form.userId && form.raceId && sprOpen  && fullSpr && isSprintRace);

  /* ─────────────── cambio semplici (user / race) ─────────────── */
  const onChangeSimple = e=>{
    const {name,value}=e.target;
    setForm(f=>({...f,[name]:value}));

    if (name==="userId"){
      const me = ranking.find(u=>u.id===value);
      setUserJolly(me?.jolly ?? 0);
      setIsEditMode(false);
    }
    if (name==="raceId"){
      const r = races.find(r=>r.id===value);
      setRace(r??null);
      // reset selezioni
      setForm(f=>({
        ...f, raceId:value,
        P1:null,P2:null,P3:null,jolly:null,jolly2:null,
        sprintP1:null,sprintP2:null,sprintP3:null,sprintJolly:null
      }));
      setIsEditMode(false);
    }
  };

  const onSelectChange = (sel,field)=> setForm(f=>({...f,[field]:sel}));

  /* ─────────────── prefill se esiste submission ─────────────── */
  useEffect(()=>{
    const {userId,raceId}=form;
    if(!userId||!raceId){ setIsEditMode(false); return; }

    (async()=>{
      const snap = await getDoc(doc(db,"races",raceId,"submissions",userId));
      if(!snap.exists()){ setIsEditMode(false); return; }
      const d = snap.data();
      const opt = v=>driverOpts.find(o=>o.value===v)??null;
      setForm(f=>({
        ...f,
        P1:opt(d.mainP1),P2:opt(d.mainP2),P3:opt(d.mainP3),
        jolly:opt(d.mainJolly), jolly2:opt(d.mainJolly2),
        sprintP1:opt(d.sprintP1), sprintP2:opt(d.sprintP2),
        sprintP3:opt(d.sprintP3), sprintJolly:opt(d.sprintJolly),
      }));
      setIsEditMode(true);
    })().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[form.userId,form.raceId]);

  /* ─────────────── validazione contestuale ─────────────── */
  const validate = mode=>{
    const err=[];
    if(!form.userId) err.push("Scegli l’utente.");
    if(!form.raceId) err.push("Scegli la gara.");

    if(mode==="main"){
      if(!mainOpen) err.push("Deadline gara chiusa.");
      if(!fullMain) err.push("Completa la formazione principale.");
    }else{
      if(!isSprintRace) err.push("Questa gara non prevede Sprint.");
      if(!sprOpen) err.push("Deadline sprint chiusa.");
      if(!fullSpr) err.push("Completa la Sprint.");
    }
    return err;
  };

  /* ─────────────── salvataggio ─────────────── */
  const save = async e=>{
    e.preventDefault();
    setFlash(null);
    const mode=savingMode;           // impostato dal bottone
    if(!mode||!race) return;

    const errs = validate(mode);
    if(errs.length){ setFlash({type:"danger",msg:errs.join(" ")}); return; }

    const me = ranking.find(u=>u.id===form.userId);
    const payload = {
      userId:form.userId, user:me?.name??"",
    };

    if(mode==="main"){
      Object.assign(payload,{
        mainP1:form.P1.value, mainP2:form.P2.value, mainP3:form.P3.value,
        mainJolly:form.jolly.value,
        ...(form.jolly2 ? {mainJolly2:form.jolly2.value}:{}),
      });
    }else{
      Object.assign(payload,{
        sprintP1:form.sprintP1.value, sprintP2:form.sprintP2.value,
        sprintP3:form.sprintP3.value, sprintJolly:form.sprintJolly.value,
      });
    }

    try{
      await setDoc(
        doc(db,"races",form.raceId,"submissions",form.userId),
        payload,{merge:true}
      );
      if(mode==="main" && form.jolly2){
        await updateDoc(doc(db,"ranking",form.userId),{jolly:increment(-1)});
        setUserJolly(p=>p-1);
      }
      setFlash({
        type:"success",
        msg: mode==="main"
            ? (isEditMode?"Gara aggiornata!":"Formazione gara salvata!")
            : (isEditMode?"Sprint aggiornata!":"Formazione sprint salvata!")
      });
      setRefreshKey(Date.now());
      setSavingMode(null);
    }catch(err){
      console.error(err);
      setFlash({type:"danger", msg:"Errore nel salvataggio"});
    }
  };

  /* ─────────────── UI stato busy / errori permessi ─────────────── */
  if(busy)       return <SpinnerScreen/>;
  if(permError)  return <PermError/>;

  /* ─────────────── helpers UI ─────────────── */
  const DeadlineBadgeLocal = ({open})=>(
    <Badge bg={open?"success":"danger"}>{open?"APERTO":"CHIUSO"}</Badge>
  );

  /* ─────────────────────────────── JSX ───────────────────────────── */
  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* ---------- FORM ---------- */}
        <Col xs={12} lg={6}>
          <Card className="shadow h-100 border-danger">
            <Card.Body>
              <Card.Title className="text-center mb-3">
                🏎️ Schiera la Formazione
              </Card.Title>

              {flash && (
                <Alert variant={flash.type} dismissible onClose={()=>setFlash(null)}>
                  {flash.msg}
                </Alert>
              )}

              {/* Submit unico, ma savingMode viene impostato dal bottone */}
              <Form onSubmit={save}>
                {/* Utente */}
                <Form.Group className="mb-3">
                  <Form.Label>Utente</Form.Label>
                  <Form.Select name="userId" value={form.userId} onChange={onChangeSimple} required>
                    <option value="">Seleziona utente</option>
                    {ranking.map(u=>(
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Form.Select>
                  {form.userId && <Form.Text>Jolly disponibili: {userJolly}</Form.Text>}
                </Form.Group>

                {/* Gara */}
                <Form.Group className="mb-3">
                  <Form.Label>Gara</Form.Label>
                  <Form.Select name="raceId" value={form.raceId} onChange={onChangeSimple} required>
                    <option value="">Seleziona gara</option>
                    {races.map(r=>(
                      <option key={r.id} value={r.id}>{r.round}. {r.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {/* MAIN */}
                {race && (
                  <>
                    <SectionHeader
                      title="Gara Principale"
                      open={mainOpen}
                      deadlineMs={qualiMs}
                    />
                    {["P1","P2","P3"].map(l=>(
                      <DriverSelect key={l} label={l} field={l}/>
                    ))}
                    <DriverSelect label="Jolly" field="jolly"/>
                    {userJolly>0 && <DriverSelect label="Jolly 2 (opz.)" field="jolly2" />}
                  </>
                )}

                {/* SPRINT */}
                {isSprintRace && (
                  <>
                    <SectionHeader
                      title="Sprint"
                      open={sprOpen}
                      deadlineMs={sprMs}
                    />
                    {["sprintP1","sprintP2","sprintP3","sprintJolly"].map(f=>(
                      <DriverSelect key={f} label={f.replace("sprint","SP")} field={f}/>
                    ))}
                  </>
                )}

                {/* BOTTONI */}
                <Row className="g-2 mt-3">
                  <Col xs={isSprintRace ? 6 : 12}>
                    <Button
                      variant="danger"
                      className="w-100"
                      type="submit"
                      formNoValidate
                      disabled={disabledMain}
                      onClick={()=>setSavingMode("main")}
                    >
                      {isEditMode ? "Modifica Gara" : "Salva Gara"}
                    </Button>
                  </Col>
                  {isSprintRace && (
                    <Col xs={6}>
                      <Button
                        variant="warning"
                        className="w-100"
                        type="submit"
                        formNoValidate
                        disabled={disabledSprint}
                        onClick={()=>setSavingMode("sprint")}
                      >
                        {isEditMode ? "Modifica Sprint" : "Salva Sprint"}
                      </Button>
                    </Col>
                  )}
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* ---------- LISTA FORMAZIONI ---------- */}
        <Col xs={12} lg={6}>
          {race && (
            <RaceHistoryCard
              race={race}
              showOfficialResults={false}
              showPoints={false}
              compact={true}
            />
          )}
        </Col>
      </Row>
    </Container>
  );

  /* ─────────────── componenti ausiliari inline ─────────────── */
  function SpinnerScreen(){ return (
    <Container className="py-5 text-center"><Spinner animation="border"/></Container>
  );}
  function PermError(){ return (
    <Container className="py-5"><Alert variant="danger">Permessi insufficienti.</Alert></Container>
  );}

  function SectionHeader({title,open,deadlineMs}){
    return (
      <h5 className="mt-3">
        {title}&nbsp;<DeadlineBadgeLocal open={open}/>
        <br/>
        <small>
          Da schierare entro:&nbsp;
          {new Date(deadlineMs).toLocaleDateString("it-IT",{day:"numeric",month:"long"})}
          {" – "}
          {new Date(deadlineMs).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"})}
        </small>
      </h5>
    );
  }

  function DriverSelect({label,field}){
    const disabled = field.startsWith("sprint") ? !sprOpen : !mainOpen;
    return (
      <Form.Group className="mb-2">
        <Form.Label>{label}</Form.Label>
        <Select
          isDisabled={disabled}
          options={driverOpts}
          value={form[field]}
          onChange={sel=>onSelectChange(sel,field)}
          placeholder={`Seleziona ${label}`}
          classNamePrefix="react-select"
          required={field==="jolly" || field==="sprintJolly" || !field.endsWith("2")}
        />
      </Form.Group>
    );
  }
}