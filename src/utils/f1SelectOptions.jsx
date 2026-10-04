/**
 * @file react-select options for drivers and teams (logo + name).
 * The option value is always the name stored in formations/results.
 */

/**
 * Builds a react-select option with the team logo
 * @param {string} name - Driver or team name (option value)
 * @param {string|null} logo - Logo path
 * @param {string} [alt] - Alt text for the logo
 * @returns {{value: string, label: JSX.Element}}
 */
export function makeLogoOption(name, logo, alt = "") {
  return {
    value: name,
    label: (
      <div className="select-option">
        {logo && <img src={logo} className="option-logo" alt={alt} loading="lazy" />}
        <span className="option-text">{name}</span>
      </div>
    ),
  };
}

/**
 * Driver options from useF1Data() drivers
 * @param {Array<Object>} drivers - Drivers ({ name })
 * @param {Function} getDriverTeam - name → team name
 * @param {Function} getTeamLogo - team name → logo path
 * @returns {Array<Object>} Options
 */
export function buildDriverOptions(drivers, getDriverTeam, getTeamLogo) {
  return drivers.map((d) => {
    const team = getDriverTeam(d.name);
    return makeLogoOption(d.name, team ? getTeamLogo(team) : null, team ? `${team} team logo` : "");
  });
}

/**
 * Team options from useF1Data() teams
 * @param {Array<Object>} teams - Teams ({ name, logo })
 * @returns {Array<Object>} Options
 */
export function buildTeamOptions(teams) {
  return teams.map((t) => makeLogoOption(t.name, t.logo, `${t.name} logo`));
}

/**
 * Finds the option for a saved value; values no longer in the list (e.g. a
 * driver made non-selectable) still get an option so they don't disappear.
 * @param {Array<Object>} options - Options
 * @param {string|null} value - Saved value
 * @param {Function} [getLogo] - name → logo path
 * @returns {Object|null} Option or null
 */
export function findOptionOrCreate(options, value, getLogo) {
  if (!value) return null;
  return options.find((o) => o.value === value) || makeLogoOption(value, getLogo ? getLogo(value) : null);
}
