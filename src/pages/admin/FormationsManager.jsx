/**
 * @file FormationsManager.jsx
 * @description Formations management component for admin panel
 */

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Alert,
  Spinner,
} from "react-bootstrap";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { DRIVERS } from "../../constants/racing";
import Select from "react-select";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";

/**
 * Formations management component for admin editing
 * @param {Object} props - Component props
 * @param {Array} props.participants - List of participants
 * @param {Array} props.races - List of races
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Formations management interface
 */
export default function FormationsManager({ participants, races, loading, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [touched, setTouched] = useState(false);

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRace, setSelectedRace] = useState(null);
  const [existingFormation, setExistingFormation] = useState(null);
  const [racesWithFormations, setRacesWithFormations] = useState(new Set());

  const [formData, setFormData] = useState({
    mainP1: null,
    mainP2: null,
    mainP3: null,
    mainJolly: null,
    mainJolly2: null,
    sprintP1: null,
    sprintP2: null,
    sprintP3: null,
    sprintJolly: null,
  });

  const [isLateSubmission, setIsLateSubmission] = useState(false);

  // Load formation status and auto-select first race without formation
  useEffect(() => {
    if (!selectedUser || races.length === 0) return;

    (async () => {
      const racesWithForms = new Set();
      let firstRaceWithoutForm = null;

      for (const race of races) {
        const formDoc = await getDoc(
          doc(db, "races", race.id, "submissions", selectedUser)
        );
        if (formDoc.exists()) {
          racesWithForms.add(race.id);
        } else if (!firstRaceWithoutForm) {
          firstRaceWithoutForm = race;
        }
      }

      setRacesWithFormations(racesWithForms);

      if (firstRaceWithoutForm) {
        setSelectedRace(firstRaceWithoutForm);
      } else if (races.length > 0 && !selectedRace) {
        setSelectedRace(races[0]);
      }
    })();
  }, [selectedUser, races]);

  // Load existing formation when user and race are selected
  useEffect(() => {
    if (!selectedUser || !selectedRace) {
      setExistingFormation(null);
      resetForm();
      return;
    }

    loadFormation();
  }, [selectedUser, selectedRace]);

  const loadFormation = async () => {
    try {
      const formDoc = await getDoc(
        doc(db, "races", selectedRace.id, "submissions", selectedUser)
      );

      if (formDoc.exists()) {
        const data = formDoc.data();
        setExistingFormation(data);

        setFormData({
          mainP1: findDriverOption(data.mainP1),
          mainP2: findDriverOption(data.mainP2),
          mainP3: findDriverOption(data.mainP3),
          mainJolly: findDriverOption(data.mainJolly),
          mainJolly2: findDriverOption(data.mainJolly2),
          sprintP1: findDriverOption(data.sprintP1),
          sprintP2: findDriverOption(data.sprintP2),
          sprintP3: findDriverOption(data.sprintP3),
          sprintJolly: findDriverOption(data.sprintJolly),
        });
        setIsLateSubmission(data.isLate ?? false);
      } else {
        setExistingFormation(null);
        resetForm();
      }
    } catch (err) {
      error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      mainP1: null, mainP2: null, mainP3: null,
      mainJolly: null, mainJolly2: null,
      sprintP1: null, sprintP2: null, sprintP3: null,
      sprintJolly: null,
    });
    setIsLateSubmission(false);
  };

  const findDriverOption = (name) => {
    if (!name) return null;
    return driverOptions.find((opt) => opt.value === name) || null;
  };

  const getSelectedMainDrivers = () => {
    return [formData.mainP1, formData.mainP2, formData.mainP3, formData.mainJolly, formData.mainJolly2]
      .filter(Boolean).map(d => d.value);
  };

  const getSelectedSprintDrivers = () => {
    return [formData.sprintP1, formData.sprintP2, formData.sprintP3, formData.sprintJolly]
      .filter(Boolean).map(d => d.value);
  };

  const getAvailableMainOptions = (currentField) => {
    const selectedDrivers = getSelectedMainDrivers();
    const currentValue = formData[currentField]?.value;
    return driverOptions.filter(opt =>
      !selectedDrivers.includes(opt.value) || opt.value === currentValue
    );
  };

  const getAvailableSprintOptions = (currentField) => {
    const selectedDrivers = getSelectedSprintDrivers();
    const currentValue = formData[currentField]?.value;
    return driverOptions.filter(opt =>
      !selectedDrivers.includes(opt.value) || opt.value === currentValue
    );
  };

  const validateForm = () => {
    const errors = [];
    if (!selectedUser) errors.push(t("admin.selectUser"));
    if (!selectedRace) errors.push(t("admin.selectRace"));
    if (!formData.mainP1) errors.push(`P1 ${t("formations.required")}`);
    if (!formData.mainP2) errors.push(`P2 ${t("formations.required")}`);
    if (!formData.mainP3) errors.push(`P3 ${t("formations.required")}`);
    if (!formData.mainJolly) errors.push(`${t("formations.joker")} ${t("formations.required")}`);

    const mainDrivers = [
      formData.mainP1?.value, formData.mainP2?.value, formData.mainP3?.value,
      formData.mainJolly?.value, formData.mainJolly2?.value
    ].filter(Boolean);
    if (new Set(mainDrivers).size !== mainDrivers.length) {
      errors.push(t("errors.duplicateDriver"));
    }

    if (hasSprint) {
      const sprintDrivers = [
        formData.sprintP1?.value, formData.sprintP2?.value,
        formData.sprintP3?.value, formData.sprintJolly?.value
      ].filter(Boolean);
      if (sprintDrivers.length > 0 && new Set(sprintDrivers).size !== sprintDrivers.length) {
        errors.push(t("errors.duplicateDriver"));
      }
    }

    return errors;
  };

  const isFieldInvalid = (fieldName) => {
    if (!touched || !selectedUser || !selectedRace) return false;
    const requiredFields = ['mainP1', 'mainP2', 'mainP3', 'mainJolly'];
    return requiredFields.includes(fieldName) && !formData[fieldName];
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched(true);

    const errors = validateForm();
    if (errors.length > 0) {
      setMessage({ type: "danger", text: errors.join(". ") + "." });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const user = participants.find((p) => p.id === selectedUser);

      const payload = {
        user: user?.name || selectedUser,
        userId: selectedUser,
        mainP1: formData.mainP1.value,
        mainP2: formData.mainP2.value,
        mainP3: formData.mainP3.value,
        mainJolly: formData.mainJolly.value,
        mainJolly2: formData.mainJolly2?.value || null,
        sprintP1: formData.sprintP1?.value || null,
        sprintP2: formData.sprintP2?.value || null,
        sprintP3: formData.sprintP3?.value || null,
        sprintJolly: formData.sprintJolly?.value || null,
        submittedAt: Timestamp.now(),
      };

      if (isLateSubmission) {
        payload.isLate = true;
        payload.latePenalty = -3;
        await updateDoc(doc(db, "ranking", selectedUser), {
          usedLateSubmission: true
        });
      }

      await setDoc(doc(db, "races", selectedRace.id, "submissions", selectedUser), payload, {
        merge: true,
      });

      setMessage({
        type: "success",
        text: existingFormation ? t("admin.formationUpdated") : t("admin.formationAdded"),
      });
      setTouched(false);
      setRacesWithFormations(prev => new Set([...prev, selectedRace.id]));
      await loadFormation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const driverOptions = DRIVERS.map((d) => ({ value: d, label: d }));
  const hasSprint = Boolean(selectedRace?.qualiSprintUTC);

  // Custom styles for react-select with dark mode support
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: isDark ? '#2d3748' : '#fff',
      borderColor: state.isFocused ? '#dc3545' : isDark ? '#4a5568' : '#ced4da',
      boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(220,53,69,.25)' : 'none',
      '&:hover': { borderColor: '#dc3545' },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? '#2d3748' : '#fff',
      border: isDark ? '1px solid #4a5568' : '1px solid #ced4da',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? (isDark ? '#4a5568' : '#f8f9fa') : (isDark ? '#2d3748' : '#fff'),
      color: isDark ? '#e2e8f0' : '#212529',
      '&:active': { backgroundColor: isDark ? '#4a5568' : '#e2e6ea' },
    }),
    singleValue: (base) => ({ ...base, color: isDark ? '#e2e8f0' : '#212529' }),
    input: (base) => ({ ...base, color: isDark ? '#e2e8f0' : '#212529' }),
    placeholder: (base) => ({ ...base, color: isDark ? '#a0aec0' : '#6c757d' }),
  };

  const invalidSelectStyles = {
    ...selectStyles,
    control: (base, state) => ({
      ...selectStyles.control(base, state),
      borderColor: '#dc3545',
      boxShadow: '0 0 0 0.2rem rgba(220,53,69,.25)',
    }),
  };

  const bgCard = isDark ? 'var(--bg-secondary)' : '#ffffff';
  const bgHeader = isDark ? 'var(--bg-tertiary)' : '#ffffff';

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  const renderSelect = (field, label, required, optionsFn, isSprint = false) => (
    <Form.Group className="mb-2">
      <Form.Label>{label} {required && '*'} {isFieldInvalid(field) && <span className="text-danger">({t("formations.required")})</span>}</Form.Label>
      <Select
        options={optionsFn(field)}
        value={formData[field]}
        onChange={(sel) => setFormData({ ...formData, [field]: sel })}
        placeholder={t("formations.selectUser")}
        styles={isFieldInvalid(field) ? invalidSelectStyles : selectStyles}
        isClearable={!required}
        noOptionsMessage={() => t("errors.duplicateDriver")}
        aria-label={`Select driver for ${label}`}
      />
    </Form.Group>
  );

  return (
    <Row className="g-4">
      <Col xs={12}>
        {message && (
          <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
      </Col>

      <Col xs={12}>
        <Card className="shadow" style={{ backgroundColor: bgCard }}>
          <Card.Header style={{ backgroundColor: bgHeader }}>
            <h5 className="mb-0">
              {existingFormation ? `✏️ ${t("admin.editFormationTitle")}` : `➕ ${t("admin.addFormation")}`}
            </h5>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSave}>
              {/* User Selection */}
              <Form.Group className="mb-3">
                <Form.Label>{t("formations.selectUser")} *</Form.Label>
                <Form.Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  required
                  aria-label="Select user to manage formation for"
                >
                  <option value="">{t("formations.selectUser")}</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Race Selection */}
              <Form.Group className="mb-3">
                <Form.Label>{t("formations.selectRace")} *</Form.Label>
                <Form.Select
                  value={selectedRace?.id || ""}
                  onChange={(e) => {
                    const race = races.find((r) => r.id === e.target.value);
                    setSelectedRace(race || null);
                  }}
                  required
                  aria-label="Select race to manage formation for"
                >
                  <option value="">{t("formations.selectRace")}</option>
                  {races.map((r) => {
                    const hasFormation = racesWithFormations.has(r.id);
                    const isCalculated = r.pointsCalculated;
                    const isSprint = r.qualiSprintUTC;
                    let indicators = [];
                    if (isSprint) indicators.push("🏃");
                    if (hasFormation) indicators.push("✓");
                    if (isCalculated) indicators.push("📊");
                    const label = `${r.round}. ${r.name}${indicators.length > 0 ? ` ${indicators.join(" ")}` : ""}`;
                    return <option key={r.id} value={r.id}>{label}</option>;
                  })}
                </Form.Select>
                <Form.Text className="text-muted">
                  🏃 = {t("formations.sprint")} | ✓ = {t("formations.editFormation")} | 📊 = {t("common.points")}
                </Form.Text>
              </Form.Group>

              {selectedUser && selectedRace && (
                <>
                  <hr />
                  <h6 className="fw-bold">{t("formations.mainRace")}</h6>

                  {renderSelect('mainP1', 'P1', true, getAvailableMainOptions)}
                  {renderSelect('mainP2', 'P2', true, getAvailableMainOptions)}
                  {renderSelect('mainP3', 'P3', true, getAvailableMainOptions)}
                  {renderSelect('mainJolly', t("formations.joker"), true, getAvailableMainOptions)}

                  <Form.Group className="mb-3">
                    <Form.Label>{t("formations.joker2")}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainJolly2')}
                      value={formData.mainJolly2}
                      onChange={(sel) => setFormData({ ...formData, mainJolly2: sel })}
                      placeholder={t("formations.selectUser")}
                      styles={selectStyles}
                      isClearable
                      noOptionsMessage={() => t("errors.duplicateDriver")}
                      aria-label="Select driver for second joker (optional)"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label={`⏰ ${t("formations.lateSubmission")} (${t("formations.latePenalty")})`}
                      checked={isLateSubmission}
                      onChange={(e) => setIsLateSubmission(e.target.checked)}
                    />
                  </Form.Group>

                  {hasSprint && (
                    <>
                      <hr />
                      <h6 className="fw-bold">{t("formations.sprintOptional")}</h6>
                      <Alert variant="info" className="py-2 small">
                        <strong>ℹ️</strong> {t("formations.optional")}
                      </Alert>

                      {renderSelect('sprintP1', 'SP1', false, getAvailableSprintOptions, true)}
                      {renderSelect('sprintP2', 'SP2', false, getAvailableSprintOptions, true)}
                      {renderSelect('sprintP3', 'SP3', false, getAvailableSprintOptions, true)}

                      <Form.Group className="mb-3">
                        <Form.Label>{t("formations.joker")} {t("formations.sprint")}</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintJolly')}
                          value={formData.sprintJolly}
                          onChange={(sel) => setFormData({ ...formData, sprintJolly: sel })}
                          placeholder={t("formations.selectUser")}
                          styles={selectStyles}
                          isClearable
                          noOptionsMessage={() => t("errors.duplicateDriver")}
                          aria-label="Select driver for sprint joker"
                        />
                      </Form.Group>
                    </>
                  )}

                  <Button variant="danger" type="submit" disabled={saving} className="w-100" aria-label={existingFormation ? "Update formation" : "Save new formation"}>
                    {saving ? t("common.loading") : existingFormation ? t("common.update") : t("common.save")}
                  </Button>
                </>
              )}
            </Form>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

FormationsManager.propTypes = {
  participants: PropTypes.arrayOf(PropTypes.object).isRequired,
  races: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
