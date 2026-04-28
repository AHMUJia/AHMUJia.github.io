/**
 * Mapping table from "section name" used in the API/storage to:
 *   - the global var name used by the frontend renderers (`window.__X__`)
 *   - whether the section has separate zh/en files (split: true) or is a single
 *     bilingual file (split: false, e.g. team-data.js with {zh,en} entries inline)
 *   - the actual *-data.js file names in the site directory
 *
 * Keep this in sync with what the static site's HTML pages load via <script>.
 */
export const SECTIONS = {
  about:        { var: '__ABOUT__',       split: true,  zhFile: 'about-data.js',        enFile: 'about-data_en.js' },
  education:    { var: '__EDUCATION__',   split: true,  zhFile: 'education-data.js',    enFile: 'education-data_en.js' },
  experience:   { var: '__EXPERIENCE__',  split: true,  zhFile: 'experience-data.js',   enFile: 'experience-data_en.js' },
  projects:     { var: '__PROJECTS__',    split: true,  zhFile: 'projects-data.js',     enFile: 'projects-data_en.js' },
  awards:       { var: '__AWARDS__',      split: true,  zhFile: 'awards-data.js',       enFile: 'awards-data_en.js' },
  research:     { var: '__RESEARCH__',    split: true,  zhFile: 'research-data.js',     enFile: 'research-data_en.js' },
  tools:        { var: '__TOOLS__',       split: true,  zhFile: 'tools-data.js',        enFile: 'tools-data_en.js' },
  publications: { var: '__PUBS__',        split: true,  zhFile: 'publications-data.js', enFile: 'publications-data_en.js' },
  team:         { var: '__TEAM__',        split: false, file:   'team-data.js' },
  teamMeta:     { var: '__TEAM_META__',   split: false, file:   'team-meta-data.js', isObject: true }
};
