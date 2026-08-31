/**
 * Auth UI — modern full-page · Sign In / Sign Up · theme toggle
 */

import { auth } from "../config/firebase.js";
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeOnboarding,
  sendPasswordReset,
  mapAuthError,
  resetRecaptcha,
  setupRecaptcha,
} from "./auth.js";
import { getState } from "../core/state.js";
import { showToast } from "../components/toast.js";
import {
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
  isValidUsername,
  normalizeUsername,
} from "../utils/validation.js";
import { hasAcceptedLegal, renderLegalGate } from "./legal.js";

/* ── Country dial codes (common list) ───────────────────── */

const COUNTRIES = [
  { iso: "AF", name: "Afghanistan", dial: "93", flag: "🇦🇫" },
  { iso: "AL", name: "Albania", dial: "355", flag: "🇦🇱" },
  { iso: "DZ", name: "Algeria", dial: "213", flag: "🇩🇿" },
  { iso: "AS", name: "American Samoa", dial: "1684", flag: "🇦🇸" },
  { iso: "AD", name: "Andorra", dial: "376", flag: "🇦🇩" },
  { iso: "AO", name: "Angola", dial: "244", flag: "🇦🇴" },
  { iso: "AI", name: "Anguilla", dial: "1264", flag: "🇦🇮" },
  { iso: "AQ", name: "Antarctica", dial: "672", flag: "🇦🇶" },
  { iso: "AG", name: "Antigua and Barbuda", dial: "1268", flag: "🇦🇬" },
  { iso: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { iso: "AM", name: "Armenia", dial: "374", flag: "🇦🇲" },
  { iso: "AW", name: "Aruba", dial: "297", flag: "🇦🇼" },
  { iso: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso: "AT", name: "Austria", dial: "43", flag: "🇦🇹" },
  { iso: "AZ", name: "Azerbaijan", dial: "994", flag: "🇦🇿" },

  { iso: "BS", name: "Bahamas", dial: "1242", flag: "🇧🇸" },
  { iso: "BH", name: "Bahrain", dial: "973", flag: "🇧🇭" },
  { iso: "BD", name: "Bangladesh", dial: "880", flag: "🇧🇩" },
  { iso: "BB", name: "Barbados", dial: "1246", flag: "🇧🇧" },
  { iso: "BY", name: "Belarus", dial: "375", flag: "🇧🇾" },
  { iso: "BE", name: "Belgium", dial: "32", flag: "🇧🇪" },
  { iso: "BZ", name: "Belize", dial: "501", flag: "🇧🇿" },
  { iso: "BJ", name: "Benin", dial: "229", flag: "🇧🇯" },
  { iso: "BM", name: "Bermuda", dial: "1441", flag: "🇧🇲" },
  { iso: "BT", name: "Bhutan", dial: "975", flag: "🇧🇹" },
  { iso: "BO", name: "Bolivia", dial: "591", flag: "🇧🇴" },
  { iso: "BA", name: "Bosnia and Herzegovina", dial: "387", flag: "🇧🇦" },
  { iso: "BW", name: "Botswana", dial: "267", flag: "🇧🇼" },
  { iso: "BR", name: "Brazil", dial: "55", flag: "🇧🇷" },
  { iso: "BN", name: "Brunei", dial: "673", flag: "🇧🇳" },
  { iso: "BG", name: "Bulgaria", dial: "359", flag: "🇧🇬" },
  { iso: "BF", name: "Burkina Faso", dial: "226", flag: "🇧🇫" },
  { iso: "BI", name: "Burundi", dial: "257", flag: "🇧🇮" },

  { iso: "KH", name: "Cambodia", dial: "855", flag: "🇰🇭" },
  { iso: "CM", name: "Cameroon", dial: "237", flag: "🇨🇲" },
  { iso: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { iso: "CV", name: "Cape Verde", dial: "238", flag: "🇨🇻" },
  { iso: "KY", name: "Cayman Islands", dial: "1345", flag: "🇰🇾" },
  { iso: "CF", name: "Central African Republic", dial: "236", flag: "🇨🇫" },
  { iso: "TD", name: "Chad", dial: "235", flag: "🇹🇩" },
  { iso: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { iso: "CN", name: "China", dial: "86", flag: "🇨🇳" },
  { iso: "CO", name: "Colombia", dial: "57", flag: "🇨🇴" },
  { iso: "KM", name: "Comoros", dial: "269", flag: "🇰🇲" },
  { iso: "CG", name: "Congo", dial: "242", flag: "🇨🇬" },
  { iso: "CD", name: "Congo, Democratic Republic", dial: "243", flag: "🇨🇩" },
  { iso: "CR", name: "Costa Rica", dial: "506", flag: "🇨🇷" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "225", flag: "🇨🇮" },
  { iso: "HR", name: "Croatia", dial: "385", flag: "🇭🇷" },
  { iso: "CU", name: "Cuba", dial: "53", flag: "🇨🇺" },
  { iso: "CY", name: "Cyprus", dial: "357", flag: "🇨🇾" },
  { iso: "CZ", name: "Czech Republic", dial: "420", flag: "🇨🇿" },

  { iso: "DK", name: "Denmark", dial: "45", flag: "🇩🇰" },
  { iso: "DJ", name: "Djibouti", dial: "253", flag: "🇩🇯" },
  { iso: "DM", name: "Dominica", dial: "1767", flag: "🇩🇲" },
  { iso: "DO", name: "Dominican Republic", dial: "1809", flag: "🇩🇴" },

  { iso: "EC", name: "Ecuador", dial: "593", flag: "🇪🇨" },
  { iso: "EG", name: "Egypt", dial: "20", flag: "🇪🇬" },
  { iso: "SV", name: "El Salvador", dial: "503", flag: "🇸🇻" },
  { iso: "GQ", name: "Equatorial Guinea", dial: "240", flag: "🇬🇶" },
  { iso: "ER", name: "Eritrea", dial: "291", flag: "🇪🇷" },
  { iso: "EE", name: "Estonia", dial: "372", flag: "🇪🇪" },
  { iso: "SZ", name: "Eswatini", dial: "268", flag: "🇸🇿" },
  { iso: "ET", name: "Ethiopia", dial: "251", flag: "🇪🇹" },

  { iso: "FJ", name: "Fiji", dial: "679", flag: "🇫🇯" },
  { iso: "FI", name: "Finland", dial: "358", flag: "🇫🇮" },
  { iso: "FR", name: "France", dial: "33", flag: "🇫🇷" },

  { iso: "GA", name: "Gabon", dial: "241", flag: "🇬🇦" },
  { iso: "GM", name: "Gambia", dial: "220", flag: "🇬🇲" },
  { iso: "GE", name: "Georgia", dial: "995", flag: "🇬🇪" },
  { iso: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { iso: "GH", name: "Ghana", dial: "233", flag: "🇬🇭" },
  { iso: "GR", name: "Greece", dial: "30", flag: "🇬🇷" },
  { iso: "GD", name: "Grenada", dial: "1473", flag: "🇬🇩" },
  { iso: "GT", name: "Guatemala", dial: "502", flag: "🇬🇹" },
  { iso: "GN", name: "Guinea", dial: "224", flag: "🇬🇳" },
  { iso: "GW", name: "Guinea-Bissau", dial: "245", flag: "🇬🇼" },
  { iso: "GY", name: "Guyana", dial: "592", flag: "🇬🇾" },

  { iso: "HT", name: "Haiti", dial: "509", flag: "🇭🇹" },
  { iso: "HN", name: "Honduras", dial: "504", flag: "🇭🇳" },
  { iso: "HK", name: "Hong Kong", dial: "852", flag: "🇭🇰" },
  { iso: "HU", name: "Hungary", dial: "36", flag: "🇭🇺" },

  { iso: "IS", name: "Iceland", dial: "354", flag: "🇮🇸" },
  { iso: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
  { iso: "IR", name: "Iran", dial: "98", flag: "🇮🇷" },
  { iso: "IQ", name: "Iraq", dial: "964", flag: "🇮🇶" },
  { iso: "IE", name: "Ireland", dial: "353", flag: "🇮🇪" },
  { iso: "IL", name: "Israel", dial: "972", flag: "🇮🇱" },
  { iso: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },

  { iso: "JM", name: "Jamaica", dial: "1876", flag: "🇯🇲" },
  { iso: "JP", name: "Japan", dial: "81", flag: "🇯🇵" },
  { iso: "JO", name: "Jordan", dial: "962", flag: "🇯🇴" },

  { iso: "KZ", name: "Kazakhstan", dial: "7", flag: "🇰🇿" },
  { iso: "KE", name: "Kenya", dial: "254", flag: "🇰🇪" },
  { iso: "KI", name: "Kiribati", dial: "686", flag: "🇰🇮" },
  { iso: "KP", name: "North Korea", dial: "850", flag: "🇰🇵" },
  { iso: "KR", name: "South Korea", dial: "82", flag: "🇰🇷" },
  { iso: "KW", name: "Kuwait", dial: "965", flag: "🇰🇼" },
  { iso: "KG", name: "Kyrgyzstan", dial: "996", flag: "🇰🇬" },

  { iso: "LA", name: "Laos", dial: "856", flag: "🇱🇦" },
  { iso: "LV", name: "Latvia", dial: "371", flag: "🇱🇻" },
  { iso: "LB", name: "Lebanon", dial: "961", flag: "🇱🇧" },
  { iso: "LS", name: "Lesotho", dial: "266", flag: "🇱🇸" },
  { iso: "LR", name: "Liberia", dial: "231", flag: "🇱🇷" },
  { iso: "LY", name: "Libya", dial: "218", flag: "🇱🇾" },
  { iso: "LI", name: "Liechtenstein", dial: "423", flag: "🇱🇮" },
  { iso: "LT", name: "Lithuania", dial: "370", flag: "🇱🇹" },
  { iso: "LU", name: "Luxembourg", dial: "352", flag: "🇱🇺" },

  { iso: "MO", name: "Macao", dial: "853", flag: "🇲🇴" },
  { iso: "MG", name: "Madagascar", dial: "261", flag: "🇲🇬" },
  { iso: "MW", name: "Malawi", dial: "265", flag: "🇲🇼" },
  { iso: "MY", name: "Malaysia", dial: "60", flag: "🇲🇾" },
  { iso: "MV", name: "Maldives", dial: "960", flag: "🇲🇻" },
  { iso: "ML", name: "Mali", dial: "223", flag: "🇲🇱" },
  { iso: "MT", name: "Malta", dial: "356", flag: "🇲🇹" },
  { iso: "MH", name: "Marshall Islands", dial: "692", flag: "🇲🇭" },
  { iso: "MR", name: "Mauritania", dial: "222", flag: "🇲🇷" },
  { iso: "MU", name: "Mauritius", dial: "230", flag: "🇲🇺" },
  { iso: "MX", name: "Mexico", dial: "52", flag: "🇲🇽" },
  { iso: "FM", name: "Micronesia", dial: "691", flag: "🇫🇲" },
  { iso: "MD", name: "Moldova", dial: "373", flag: "🇲🇩" },
  { iso: "MC", name: "Monaco", dial: "377", flag: "🇲🇨" },
  { iso: "MN", name: "Mongolia", dial: "976", flag: "🇲🇳" },
  { iso: "ME", name: "Montenegro", dial: "382", flag: "🇲🇪" },
  { iso: "MA", name: "Morocco", dial: "212", flag: "🇲🇦" },
  { iso: "MZ", name: "Mozambique", dial: "258", flag: "🇲🇿" },
  { iso: "MM", name: "Myanmar", dial: "95", flag: "🇲🇲" },

  { iso: "NA", name: "Namibia", dial: "264", flag: "🇳🇦" },
  { iso: "NR", name: "Nauru", dial: "674", flag: "🇳🇷" },
  { iso: "NP", name: "Nepal", dial: "977", flag: "🇳🇵" },
  { iso: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { iso: "NZ", name: "New Zealand", dial: "64", flag: "🇳🇿" },
  { iso: "NI", name: "Nicaragua", dial: "505", flag: "🇳🇮" },
  { iso: "NE", name: "Niger", dial: "227", flag: "🇳🇪" },
  { iso: "NG", name: "Nigeria", dial: "234", flag: "🇳🇬" },
  { iso: "NO", name: "Norway", dial: "47", flag: "🇳🇴" },

  { iso: "OM", name: "Oman", dial: "968", flag: "🇴🇲" },

  { iso: "PK", name: "Pakistan", dial: "92", flag: "🇵🇰" },
  { iso: "PW", name: "Palau", dial: "680", flag: "🇵🇼" },
  { iso: "PS", name: "Palestine", dial: "970", flag: "🇵🇸" },
  { iso: "PA", name: "Panama", dial: "507", flag: "🇵🇦" },
  { iso: "PG", name: "Papua New Guinea", dial: "675", flag: "🇵🇬" },
  { iso: "PY", name: "Paraguay", dial: "595", flag: "🇵🇾" },
  { iso: "PE", name: "Peru", dial: "51", flag: "🇵🇪" },
  { iso: "PH", name: "Philippines", dial: "63", flag: "🇵🇭" },
  { iso: "PL", name: "Poland", dial: "48", flag: "🇵🇱" },
  { iso: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { iso: "PR", name: "Puerto Rico", dial: "1787", flag: "🇵🇷" },

  { iso: "QA", name: "Qatar", dial: "974", flag: "🇶🇦" },

  { iso: "RO", name: "Romania", dial: "40", flag: "🇷🇴" },
  { iso: "RU", name: "Russia", dial: "7", flag: "🇷🇺" },
  { iso: "RW", name: "Rwanda", dial: "250", flag: "🇷🇼" },

  { iso: "SA", name: "Saudi Arabia", dial: "966", flag: "🇸🇦" },
  { iso: "SN", name: "Senegal", dial: "221", flag: "🇸🇳" },
  { iso: "RS", name: "Serbia", dial: "381", flag: "🇷🇸" },
  { iso: "SC", name: "Seychelles", dial: "248", flag: "🇸🇨" },
  { iso: "SL", name: "Sierra Leone", dial: "232", flag: "🇸🇱" },
  { iso: "SG", name: "Singapore", dial: "65", flag: "🇸🇬" },
  { iso: "SK", name: "Slovakia", dial: "421", flag: "🇸🇰" },
  { iso: "SI", name: "Slovenia", dial: "386", flag: "🇸🇮" },
  { iso: "SB", name: "Solomon Islands", dial: "677", flag: "🇸🇧" },
  { iso: "SO", name: "Somalia", dial: "252", flag: "🇸🇴" },
  { iso: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦" },
  { iso: "SS", name: "South Sudan", dial: "211", flag: "🇸🇸" },
  { iso: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { iso: "LK", name: "Sri Lanka", dial: "94", flag: "🇱🇰" },
  { iso: "SD", name: "Sudan", dial: "249", flag: "🇸🇩" },
  { iso: "SR", name: "Suriname", dial: "597", flag: "🇸🇷" },
  { iso: "SE", name: "Sweden", dial: "46", flag: "🇸🇪" },
  { iso: "CH", name: "Switzerland", dial: "41", flag: "🇨🇭" },
  { iso: "SY", name: "Syria", dial: "963", flag: "🇸🇾" },

  { iso: "TW", name: "Taiwan", dial: "886", flag: "🇹🇼" },
  { iso: "TJ", name: "Tajikistan", dial: "992", flag: "🇹🇯" },
  { iso: "TZ", name: "Tanzania", dial: "255", flag: "🇹🇿" },
  { iso: "TH", name: "Thailand", dial: "66", flag: "🇹🇭" },
  { iso: "TL", name: "Timor-Leste", dial: "670", flag: "🇹🇱" },
  { iso: "TG", name: "Togo", dial: "228", flag: "🇹🇬" },
  { iso: "TO", name: "Tonga", dial: "676", flag: "🇹🇴" },
  { iso: "TT", name: "Trinidad and Tobago", dial: "1868", flag: "🇹🇹" },
  { iso: "TN", name: "Tunisia", dial: "216", flag: "🇹🇳" },
  { iso: "TR", name: "Turkey", dial: "90", flag: "🇹🇷" },
  { iso: "TM", name: "Turkmenistan", dial: "993", flag: "🇹🇲" },
  { iso: "TV", name: "Tuvalu", dial: "688", flag: "🇹🇻" },

  { iso: "UG", name: "Uganda", dial: "256", flag: "🇺🇬" },
  { iso: "UA", name: "Ukraine", dial: "380", flag: "🇺🇦" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪" },
  { iso: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { iso: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { iso: "UY", name: "Uruguay", dial: "598", flag: "🇺🇾" },
  { iso: "UZ", name: "Uzbekistan", dial: "998", flag: "🇺🇿" },

  { iso: "VU", name: "Vanuatu", dial: "678", flag: "🇻🇺" },
  { iso: "VA", name: "Vatican City", dial: "39", flag: "🇻🇦" },
  { iso: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪" },
  { iso: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { iso: "VG", name: "British Virgin Islands", dial: "1284", flag: "🇻🇬" },
  { iso: "VI", name: "U.S. Virgin Islands", dial: "1340", flag: "🇻🇮" },

  { iso: "WS", name: "Samoa", dial: "685", flag: "🇼🇸" },
  { iso: "YE", name: "Yemen", dial: "967", flag: "🇾🇪" },
  { iso: "ZM", name: "Zambia", dial: "260", flag: "🇿🇲" },
  { iso: "ZW", name: "Zimbabwe", dial: "263", flag: "🇿🇼" },
];

// Default country = India 🇮🇳
let selectedCountry = COUNTRIES.find(
  country => country.iso === "IN"
);



let mode = "signin";
let phoneStep = "input";

function isDarkPreferred() {
  const saved = localStorage.getItem("kothiqo_ob_theme");
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
}

function ensureAuthStyles() {
  const old = document.getElementById("auth-ui-styles");
  if (old) old.remove();

  const style = document.createElement("style");
  style.id = "auth-ui-styles";
  style.textContent = `
    .auth-screen {
      --g: #00c853;
      --g2: #1de9b6;
      --g3: #00e676;
      --ink: #013c17;
      --muted: #5a6a66;
      --line: rgba(200, 233, 222, 0.1);
      --surface: rgba(255, 255, 255, 0.82);
      --input: rgba(255, 255, 255, 0.9);
      --bg0: #eef6f1;
      --bg1: #f8fbf9;
      --danger: #e53935;
      --shadow: 0 20px 60px rgba(0, 80, 40, 0.08);

      min-height: 100%;
      min-height: 100dvh;
      width: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: var(--ink);
      position: relative;
      overflow-x: hidden;
      background:
        radial-gradient(1000px 520px at 0% -10%, rgba(0, 230, 118, 0.22), transparent 55%),
        radial-gradient(800px 480px at 100% 10%, rgba(29, 233, 182, 0.14), transparent 50%),
        radial-gradient(600px 400px at 50% 100%, rgba(0, 150, 80, 0.08), transparent 45%),
        linear-gradient(165deg, var(--bg0), var(--bg1));
    }

    .auth-screen.is-dark {
      --ink: #ecf3f0;
      --muted: #93a39e;
      --line: rgba(255, 255, 255, 0.1);
      --surface: rgba(16, 24, 22, 0.75);
      --input: rgba(255, 255, 255, 0.06);
      --bg0: #070b0a;
      --bg1: #0c1412;
      --shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      background:
        radial-gradient(900px 500px at 10% -15%, rgba(0, 230, 118, 0.16), transparent 55%),
        radial-gradient(700px 420px at 100% 0%, rgba(29, 233, 182, 0.08), transparent 50%),
        linear-gradient(165deg, var(--bg0), var(--bg1));
    }

    .auth-top {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: max(14px, env(safe-area-inset-top)) 20px 10px;
      max-width: 1120px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
      z-index: 5;
    }
    .auth-top__brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .auth-top__logo-wrap {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, rgba(0,230,118,0.25), rgba(0,120,60,0.1));
      border: 1px solid rgba(0, 200, 83, 0.35);
      box-shadow: 0 8px 20px rgba(0, 200, 83, 0.2);
      flex-shrink: 0;
    }
    .auth-top__logo {
      width: 26px;
      height: 26px;
      object-fit: contain;
      display: block;
    }
    .auth-top__name {
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: -0.03em;
      background: linear-gradient(90deg, var(--ink) 40%, var(--g));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .auth-theme {
      display: inline-flex;
      align-items: center;
      gap: 0;
      padding: 4px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: var(--shadow);
    }
    .auth-theme__btn {
      width: 40px;
      height: 36px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 0.18s ease;
    }
    .auth-theme__btn.is-active {
      background: linear-gradient(180deg, var(--g3), var(--g));
      color: #041208;
      box-shadow: 0 4px 14px rgba(0, 200, 83, 0.35);
    }

    .auth-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 1120px;
      margin: 0 auto;
      box-sizing: border-box;
      min-height: 0;
      padding: 8px 20px max(24px, env(safe-area-inset-bottom));
    }

    .auth-hero { display: none; }

    .auth-panel-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }
    .auth-panel {
      width: 100%;
      max-width: 420px;
      padding: 8px 0 12px;
      box-sizing: border-box;
    }

    .auth-panel__head { margin-bottom: 20px; }
    .auth-panel__title {
      margin: 0 0 8px;
      font-size: clamp(1.65rem, 4.5vw, 1.95rem);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.15;
    }
    .auth-panel__sub {
      margin: 0;
      font-size: 0.95rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 5px;
      border-radius: 16px;
      margin-bottom: 20px;
      background: var(--surface);
      border: 1px solid var(--line);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: var(--shadow);
    }
    .auth-tab {
      border: none;
      background: transparent;
      color: var(--muted);
      font-weight: 700;
      font-size: 14px;
      padding: 12px 8px;
      border-radius: 12px;
      cursor: pointer;
      font-family: inherit;
      transition: 0.15s ease;
    }
    .auth-tab.active {
      background: linear-gradient(180deg, rgba(0,230,118,0.18), rgba(0,200,83,0.1));
      color: var(--ink);
      box-shadow: inset 0 0 0 1px rgba(0, 200, 83, 0.25);
    }

    .auth-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 7px; }
    .field__label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .field__input, .field__textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--input);
      color: var(--ink);
      font-size: 16px;
      font-family: inherit;
      outline: none;
      transition: box-shadow 0.15s, border-color 0.15s;
      backdrop-filter: blur(8px);
    }
    .field__textarea { min-height: 84px; resize: vertical; }
    .field__input:focus,
    .field__textarea:focus {
     border-color: transparent;
     box-shadow: 0 0 0 2px rgba(0, 200, 83, 0.5);
     background: #fff;
     color: #0c1210;
     }

/* Dark mode — white background নয় */
.auth-screen.is-dark .field__input:focus,
.auth-screen.is-dark .field__textarea:focus {
  background: rgba(255, 255, 255, 0.08);
  color: var(--ink);
  box-shadow: 0 0 0 2px rgba(0, 230, 118, 0.45);
}



    .field__hint { font-size: 12px; color: var(--muted); }
    .field__error {
      font-size: 13px;
      color: var(--danger);
      min-height: 18px;
      text-align: center;
      margin-top: 10px;
    }

    .auth-pass-wrap { position: relative; }
    .auth-pass-wrap .field__input { padding-right: 48px; }
    .auth-pass-toggle {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 52px;
      padding: 0 18px;
      border-radius: 14px;
      border: none;
      font-weight: 750;
      font-size: 15px;
      font-family: inherit;
      cursor: pointer;
      transition: filter 0.15s, transform 0.1s, opacity 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:active:not(:disabled) { transform: scale(0.98); }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn--block { width: 100%; }
    .btn--primary {
      background: linear-gradient(135deg, var(--g2), var(--g) 55%, #00a844);
      color: #07140b;
      box-shadow: 0 10px 28px rgba(0, 200, 83, 0.32);
    }
    .btn--primary:hover:not(:disabled) { filter: brightness(1.05); }
    .btn--secondary {
      background: var(--input);
      color: var(--ink);
      border: 1px solid var(--line);
      box-shadow: none;
    }
    .btn--secondary:hover:not(:disabled) {
      background: rgba(0, 200, 83, 0.08);
      border-color: rgba(0, 200, 83, 0.45);
      color: var(--ink);
      filter: none;
    }

    .btn--secondary:active:not(:disabled) {
      background: rgba(0, 200, 83, 0.12);
      filter: none;
    }

    /* Dark mode — slightly brighter, not muddy */
    .auth-screen.is-dark .btn--secondary {
      background: rgba(255, 255, 255, 0.06);
      color: var(--ink);
    }
    .auth-screen.is-dark .btn--secondary:hover:not(:disabled) {
      background: rgba(0, 230, 118, 0.12);
      border-color: rgba(0, 230, 118, 0.4);
      color: var(--ink);
      filter: none;
    }

    .btn--ghost {
      background: transparent;
      color: var(--g);
      min-height: 40px;
      font-size: 14px;
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 18px 0;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .auth-divider::before, .auth-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--line);
    }
    .auth-social { display: flex; flex-direction: column; gap: 10px; }
    .auth-foot { text-align: center; margin-top: 4px; }

        /* ── Phone auth modal (mobile sheet + desktop dialog) ── */
    .phone-modal {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0;
      box-sizing: border-box;
    }
    .phone-modal[hidden] {
      display: none !important;
    }
    .phone-modal__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .phone-modal__sheet {
      position: relative;
      width: 100%;
      max-width: 100%;
      max-height: min(92dvh, 640px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      color: var(--ink);
      border-radius: 20px 20px 0 0;
      border: 1px solid var(--line);
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.2);
      box-sizing: border-box;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .phone-modal__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 16px 10px;
      flex-shrink: 0;
    }
    .phone-modal__title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .phone-modal__close {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 12px;
      background: var(--input);
      color: var(--ink);
      cursor: pointer;
      font-size: 1.15rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .phone-modal__body {
      padding: 8px 16px 20px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      flex: 1;
      min-height: 0;
      overscroll-behavior: contain;
    }
    .phone-modal__hint {
      margin: 0 0 14px;
      font-size: 0.9rem;
      color: var(--muted);
      line-height: 1.45;
    }
    .phone-modal__error {
      min-height: 18px;
      margin: 10px 0 0;
      font-size: 13px;
      color: var(--danger);
      text-align: center;
    }
    .phone-modal__actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 14px;
    }

    /* Country + number inside modal */
    .phone-modal .phone-row {
      display: flex;
      gap: 8px;
      align-items: stretch;
      width: 100%;
      min-width: 0;
    }
    .phone-modal .cc-picker {
      position: relative;
      flex: 0 0 auto;
      z-index: 5;
    }
    .phone-modal .cc-picker__btn {
      min-width: 100px;
      min-height: 48px;
      height: 100%;
      padding: 0 10px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--input);
      color: var(--ink);
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .phone-modal .cc-picker__btn:hover {
      border-color: rgba(0, 200, 83, 0.4);
    }
    .phone-modal .cc-flag { font-size: 1.15rem; line-height: 1; }
    .phone-modal .cc-dial { font-variant-numeric: tabular-nums; }
    .phone-modal .cc-caret { font-size: 0.7rem; opacity: 0.7; }
    .phone-modal .phone-row .field__input {
      flex: 1 1 auto;
      min-width: 0;
      width: auto;
    }
    .phone-modal .cc-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: min(300px, calc(100vw - 48px));
      max-height: min(240px, 42vh);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--bg1, #ffffff);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: var(--shadow);
      z-index: 30;
    }
    .auth-screen.is-dark .phone-modal .cc-dropdown {
      background: #121a18;
    }
    .phone-modal .cc-dropdown[hidden] {
      display: none !important;
    }
    .phone-modal .cc-dropdown__search {
      padding: 10px;
      border-bottom: 1px solid var(--line);
      flex-shrink: 0;
    }
    .phone-modal .cc-dropdown__search input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: var(--input);
      color: var(--ink);
      font-size: 16px;
      font-family: inherit;
      outline: none;
    }
    .phone-modal .cc-dropdown__search input:focus {
      box-shadow: 0 0 0 2px rgba(0, 200, 83, 0.4);
      border-color: transparent;
    }
    .phone-modal .cc-dropdown__list {
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      max-height: min(180px, 35vh);
      padding: 6px;
      overscroll-behavior: contain;
    }
    .phone-modal .cc-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 12px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--ink);
      font-family: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      box-sizing: border-box;
    }
    .phone-modal .cc-option:hover,
    .phone-modal .cc-option.is-active {
      background: rgba(0, 200, 83, 0.12);
    }
    .phone-modal .cc-option__flag {
      font-size: 1.2rem;
      width: 1.5rem;
      text-align: center;
      flex-shrink: 0;
    }
    .phone-modal .cc-option__name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .phone-modal .cc-option__dial {
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      flex-shrink: 0;
    }

    /* Desktop: centered dialog */
    @media (min-width: 600px) {
      .phone-modal {
        align-items: center;
        padding: 24px;
      }
      .phone-modal__sheet {
        width: min(420px, 100%);
        border-radius: 20px;
        box-shadow: var(--shadow);
        max-height: min(88vh, 620px);
      }
    }

    /* Auth page desktop layout */
    @media (min-width: 960px) {
      .auth-body {
        flex-direction: row;
        align-items: stretch;
        gap: 28px;
        padding: 12px 28px 36px;
      }
      .auth-hero {
        display: flex;
        flex: 1.15;
        flex-direction: column;
        justify-content: center;
        padding: 24px 12px 24px 8px;
        min-width: 0;
      }
      .auth-hero__orb {
        width: 132px;
        height: 132px;
        border-radius: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 28px;
        background: linear-gradient(145deg, rgba(0,230,118,0.28), rgba(0,100,50,0.08));
        border: 1px solid rgba(0, 200, 83, 0.35);
        box-shadow:
          0 0 0 10px rgba(0, 200, 83, 0.06),
          0 20px 50px rgba(0, 200, 83, 0.2);
        position: relative;
      }
      .auth-hero__orb img {
        width: 72px;
        height: 72px;
        object-fit: contain;
        position: relative;
        z-index: 1;
      }
      .auth-hero h2 {
        margin: 0 0 14px;
        font-size: 2.35rem;
        font-weight: 800;
        letter-spacing: -0.035em;
        line-height: 1.12;
        max-width: 420px;
      }
      .auth-hero h2 span {
        background: linear-gradient(90deg, var(--g2), var(--g));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .auth-hero p {
        margin: 0;
        font-size: 1.05rem;
        color: var(--muted);
        line-height: 1.55;
        max-width: 380px;
      }
      .auth-hero__points {
        margin-top: 28px;
        display: grid;
        gap: 12px;
      }
      .auth-hero__point {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: var(--surface);
        border: 1px solid var(--line);
        backdrop-filter: blur(10px);
        font-size: 0.92rem;
        color: var(--ink);
        max-width: 340px;
      }
      .auth-hero__point i {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 200, 83, 0.12);
        color: var(--g);
        flex-shrink: 0;
      }
      .auth-panel-wrap {
        flex: 0 0 440px;
        align-items: center;
        border-left: 1px solid var(--line);
        padding-left: 28px;
      }
      .auth-panel {
        max-width: 400px;
        margin: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

export function renderAuth(container) {
  if (!container) return;

  if (!hasAcceptedLegal()) {
    container.hidden = false;
    renderLegalGate(container, { onAccept: () => renderAuth(container) });
    return;
  }

  ensureAuthStyles();
  const state = getState();
  const dark = isDarkPreferred();
  container.hidden = false;
  container.className = "auth-screen" + (dark ? " is-dark" : "");

  if (state.user && !state.onboardingComplete) {
    mountShell(container, dark, (panel) => renderOnboarding(panel));
    return;
  }
  mountShell(container, dark, (panel) => renderAuthForm(panel));
}

function mountShell(container, dark, fillPanel) {
  container.innerHTML = `
    <div class="auth-top">
      <div class="auth-top__brand">
        <div class="auth-top__logo-wrap">
          <img class="auth-top__logo" src="/public/icons/icon.png" alt="Kothiqo"
               onerror="this.style.display='none'" />
        </div>
        <span class="auth-top__name">kothiqo</span>
      </div>
      <div class="auth-theme" role="group" aria-label="Theme">
        <button type="button" class="auth-theme__btn ${!dark ? "is-active" : ""}" data-theme="light" title="Light">
          <i class="bi bi-sun-fill"></i>
        </button>
        <button type="button" class="auth-theme__btn ${dark ? "is-active" : ""}" data-theme="dark" title="Dark">
          <i class="bi bi-moon-stars-fill"></i>
        </button>
      </div>
    </div>

    <div class="auth-body">
      <aside class="auth-hero">
        <div class="auth-hero__orb">
          <img src="/public/icons/icon.png" alt=""
               onerror="this.remove()" />
        </div>
        <h2>Your conversations.<br/><span>Your privacy.</span></h2>
        <p>Sign in to message by username — fast, clean, and under your control.</p>
        <div class="auth-hero__points">
          <div class="auth-hero__point"><i class="bi bi-shield-lock"></i> Private by design</div>
          <div class="auth-hero__point"><i class="bi bi-lightning-charge"></i> Realtime messaging</div>
          <div class="auth-hero__point"><i class="bi bi-phone"></i> Phone, tablet &amp; desktop</div>
        </div>
      </aside>
      <div class="auth-panel-wrap">
        <div class="auth-panel" id="auth-panel"></div>
      </div>
    </div>
  `;

  container.querySelectorAll(".auth-theme__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.theme === "dark" ? "dark" : "light";
      localStorage.setItem("kothiqo_ob_theme", t);
      renderAuth(container);
    });
  });

  const panel = container.querySelector("#auth-panel");
  if (panel) fillPanel(panel);
}

function renderAuthForm(panel) {
  const isSignIn = mode === "signin";
  const root = panel.closest(".auth-screen");

  panel.innerHTML = `
    <div class="auth-panel__head">
      <h1 class="auth-panel__title">${isSignIn ? "Sign in" : "Create account"}</h1>
      <p class="auth-panel__sub">
        ${isSignIn ? "Email, Google, or phone — your choice." : "A few details and you’re ready."}
      </p>
    </div>

    <div class="auth-tabs">
      <button type="button" class="auth-tab ${isSignIn ? "active" : ""}" data-mode="signin">Sign In</button>
      <button type="button" class="auth-tab ${!isSignIn ? "active" : ""}" data-mode="signup">Sign Up</button>
    </div>

    <form id="form-email" class="auth-form" novalidate>
      ${
        !isSignIn
          ? `<div class="field">
               <label class="field__label" for="auth-name">Display name</label>
               <input class="field__input" id="auth-name" type="text" maxlength="40" placeholder="Your name" autocomplete="name" />
             </div>`
          : ""
      }
      <div class="field">
        <label class="field__label" for="auth-email">Email</label>
        <input class="field__input" id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" />
      </div>
      <div class="field">
        <label class="field__label" for="auth-pass">Password</label>
        <div class="auth-pass-wrap">
          <input class="field__input" id="auth-pass" type="password"
                 autocomplete="${isSignIn ? "current-password" : "new-password"}"
                 placeholder="${isSignIn ? "Your password" : "At least 6 characters"}" />
          <button type="button" class="auth-pass-toggle" id="btn-pass-toggle" aria-label="Show password">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      </div>
      <button type="submit" class="btn btn--primary btn--block" id="btn-email">
        <i class="bi bi-${isSignIn ? "box-arrow-in-right" : "person-plus"}"></i>
        ${isSignIn ? "Sign In" : "Create account"}
      </button>
    </form>

    ${
      isSignIn
        ? `<div class="auth-foot"><button type="button" class="btn btn--ghost" id="btn-forgot">Forgot password?</button></div>`
        : ""
    }

    <div class="auth-divider"><span>or</span></div>

    <div class="auth-social">
      <button type="button" class="btn btn--secondary btn--block" id="btn-google">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
      <button type="button" class="btn btn--secondary btn--block" id="btn-phone-toggle">
        <i class="bi bi-phone"></i> Continue with Phone
      </button>
    </div>

    <p id="auth-error" class="field__error"></p>
  `;

  bindAuthForm(panel, isSignIn, root);
}

function bindAuthForm(panel, isSignIn, root) {
  const errEl = () => panel.querySelector("#auth-error");

  panel.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.dataset.mode || "signin";
      phoneStep = "input";
      closePhoneModal();
      renderAuth(root);
    });
  });

  panel.querySelector("#btn-pass-toggle")?.addEventListener("click", () => {
    const input = panel.querySelector("#auth-pass");
    const icon = panel.querySelector("#btn-pass-toggle i");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    if (icon) icon.className = show ? "bi bi-eye-slash" : "bi bi-eye";
  });

  panel.querySelector("#form-email")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = panel.querySelector("#auth-email")?.value.trim() || "";
    const pass = panel.querySelector("#auth-pass")?.value || "";
    const name = panel.querySelector("#auth-name")?.value.trim() || "";
    const btn = panel.querySelector("#btn-email");
    const error = errEl();
    if (error) error.textContent = "";

    if (!isValidEmail(email)) {
      if (error) error.textContent = "Enter a valid email";
      return;
    }
    if (!isValidPassword(pass)) {
      if (error) error.textContent = "Password must be at least 6 characters";
      return;
    }
    if (!isSignIn && !isValidDisplayName(name)) {
      if (error) error.textContent = "Enter your display name";
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>${isSignIn ? "Signing in…" : "Creating…"}</span>`;
    }
    try {
      if (isSignIn) {
        await loginWithEmail(email, pass);
      } else {
        await registerWithEmail(email, pass);
        if (auth.currentUser && name) {
          try {
            await auth.currentUser.updateProfile({ displayName: name });
          } catch (_) {}
        }
      }
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-${isSignIn ? "box-arrow-in-right" : "person-plus"}"></i> ${
          isSignIn ? "Sign In" : "Create account"
        }`;
      }
    }
  });

  panel.querySelector("#btn-forgot")?.addEventListener("click", async () => {
    const email = panel.querySelector("#auth-email")?.value.trim() || "";
    const error = errEl();
    if (error) error.textContent = "";
    if (!isValidEmail(email)) {
      if (error) error.textContent = "Enter your email above first";
      return;
    }
    try {
      await sendPasswordReset(email);
      showToast("Password reset email sent", { type: "success" });
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
    }
  });

  panel.querySelector("#btn-google")?.addEventListener("click", async () => {
    const error = errEl();
    if (error) error.textContent = "";
    try {
      await loginWithGoogle();
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
    }
  });

  /* Phone → popup modal */
  panel.querySelector("#btn-phone-toggle")?.addEventListener("click", () => {
    openPhoneModal(panel.closest(".auth-screen") || document.body);
  });
}

function openPhoneModal(host) {
  closePhoneModal();

  const modal = document.createElement("div");
  modal.id = "phone-auth-modal";
  modal.className = "phone-modal";
  modal.innerHTML = `
    <div class="phone-modal__backdrop" data-close="1"></div>
    <div class="phone-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="phone-modal-title">
      <div class="phone-modal__head">
        <h2 class="phone-modal__title" id="phone-modal-title">Phone sign-in</h2>
        <button type="button" class="phone-modal__close" data-close="1" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="phone-modal__body">
        <p class="phone-modal__hint">Choose your country, enter your number, complete reCAPTCHA, then send the code.</p>

        <div id="phone-step-number">
          <div class="field">
            <label class="field__label" for="auth-phone">Phone number</label>
            <div class="phone-row">
              <div class="cc-picker" id="cc-picker">
                <button type="button" class="cc-picker__btn" id="cc-picker-btn" aria-haspopup="listbox">
                  <span class="cc-flag" id="cc-flag">${selectedCountry.flag}</span>
                  <span class="cc-dial" id="cc-dial">+${selectedCountry.dial}</span>
                  <span class="cc-caret"><i class="bi bi-chevron-down"></i></span>
                </button>
                <div class="cc-dropdown" id="cc-dropdown" hidden>
                  <div class="cc-dropdown__search">
                    <input type="search" id="cc-search" placeholder="Search country" autocomplete="off" />
                  </div>
                  <div class="cc-dropdown__list" id="cc-list" role="listbox"></div>
                </div>
              </div>
              <input class="field__input" id="auth-phone" type="tel"
                     placeholder="1XXXXXXXXX" autocomplete="tel-national" />
            </div>
            <span class="field__hint">Without leading 0</span>
          </div>

          <!-- reCAPTCHA widget -->
          <div id="recaptcha-container"
               style="display:flex;justify-content:center;margin:12px 0;min-height:78px;"></div>

          <div class="phone-modal__actions">
            <button type="button" class="btn btn--primary btn--block" id="btn-phone-send" disabled>
              Solve reCAPTCHA…
            </button>
          </div>
        </div>

        <div id="phone-step-otp" hidden>
          <div class="field">
            <label class="field__label" for="auth-otp">Verification code</label>
            <input class="field__input" id="auth-otp" type="text" inputmode="numeric"
                   maxlength="6" placeholder="6-digit code" autocomplete="one-time-code" />
          </div>
          <div class="phone-modal__actions">
            <button type="button" class="btn btn--primary btn--block" id="btn-phone-verify">
              <i class="bi bi-shield-check"></i> Verify &amp; Continue
            </button>
            <button type="button" class="btn btn--secondary btn--block" id="btn-phone-back">
              Change number
            </button>
          </div>
        </div>

        <p class="phone-modal__error" id="phone-modal-error"></p>
      </div>
    </div>
  `;

  host.appendChild(modal);
  document.body.style.overflow = "hidden";

  modal.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closePhoneModal());
  });

  bindCountryPicker(modal);

  const modalErr = () => modal.querySelector("#phone-modal-error");
  const sendBtn = modal.querySelector("#btn-phone-send");

  /* ── এখানেই reCAPTCHA লোড (মোডাল খোলার সাথে) ── */
  setupRecaptcha("recaptcha-container")
    .then(() => {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="bi bi-send"></i> Send OTP`;
      }
    })
    .catch((err) => {
      const error = modalErr();
      if (error) error.textContent = err.message || "reCAPTCHA failed to load";
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = "reCAPTCHA failed";
      }
    });

  /* ── Send OTP — setupRecaptcha আর কল করো না ── */
  sendBtn?.addEventListener("click", async () => {
    const local = (modal.querySelector("#auth-phone")?.value || "")
      .trim()
      .replace(/[\s\-()]/g, "")
      .replace(/^0+/, "");
    const phone = `+${selectedCountry.dial}${local}`;
    const error = modalErr();
    if (error) error.textContent = "";

    if (!local || local.length < 6) {
      if (error) error.textContent = "Enter a valid phone number";
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      if (error) error.textContent = "Invalid number for selected country";
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = "Sending…";
    }
    try {
      await sendPhoneOtp(phone);
      phoneStep = "otp";
      const stepNum = modal.querySelector("#phone-step-number");
      const stepOtp = modal.querySelector("#phone-step-otp");
      if (stepNum) stepNum.hidden = true;
      if (stepOtp) stepOtp.hidden = false;
      showToast("OTP sent", { type: "success" });
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<i class="bi bi-send"></i> Send OTP`;
      }
      // captcha may be consumed — reload for retry
      setupRecaptcha("recaptcha-container")
        .then(() => {
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = `<i class="bi bi-send"></i> Send OTP`;
          }
        })
        .catch(() => {});
    }
  });

  modal.querySelector("#btn-phone-verify")?.addEventListener("click", async () => {
    const code = (modal.querySelector("#auth-otp")?.value || "").trim();
    const error = modalErr();
    const btn = modal.querySelector("#btn-phone-verify");
    if (error) error.textContent = "";

    if (!/^\d{6}$/.test(code)) {
      if (error) error.textContent = "Enter the 6-digit code";
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "Verifying…";
    }
    try {
      await verifyPhoneOtp(code);
      closePhoneModal();
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-shield-check"></i> Verify & Continue`;
      }
    }
  });

  modal.querySelector("#btn-phone-back")?.addEventListener("click", () => {
    phoneStep = "input";
    modal.querySelector("#phone-step-otp").hidden = true;
    modal.querySelector("#phone-step-number").hidden = false;
    const err = modalErr();
    if (err) err.textContent = "";
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = "Solve reCAPTCHA…";
    }
    setupRecaptcha("recaptcha-container")
      .then(() => {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = `<i class="bi bi-send"></i> Send OTP`;
        }
      })
      .catch(() => {});
  });
}

function closePhoneModal() {
  try {
    resetRecaptcha();
  } catch (_) {}
  document.getElementById("phone-auth-modal")?.remove();
  document.body.style.overflow = "";
}

function bindCountryPicker(root) {
  const btn = root.querySelector("#cc-picker-btn");
  const drop = root.querySelector("#cc-dropdown");
  const list = root.querySelector("#cc-list");
  const search = root.querySelector("#cc-search");
  const flagEl = root.querySelector("#cc-flag");
  const dialEl = root.querySelector("#cc-dial");
  if (!btn || !drop || !list) return;

  function paintList(filter = "") {
    const q = filter.trim().toLowerCase();
    const items = COUNTRIES.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.iso.toLowerCase().includes(q)
    );
    list.innerHTML = items
      .map(
        (c) => `
      <button type="button" class="cc-option ${
        c.iso === selectedCountry.iso ? "is-active" : ""
      }" data-iso="${c.iso}" role="option">
        <span class="cc-option__flag">${c.flag}</span>
        <span class="cc-option__name">${c.name}</span>
        <span class="cc-option__dial">+${c.dial}</span>
      </button>`
      )
      .join("");

    list.querySelectorAll(".cc-option").forEach((el) => {
      el.addEventListener("click", () => {
        const c = COUNTRIES.find((x) => x.iso === el.dataset.iso);
        if (!c) return;
        selectedCountry = c;
        if (flagEl) flagEl.textContent = c.flag;
        if (dialEl) dialEl.textContent = `+${c.dial}`;
        drop.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (search) search.value = "";
      });
    });
  }

  if (flagEl) flagEl.textContent = selectedCountry.flag;
  if (dialEl) dialEl.textContent = `+${selectedCountry.dial}`;
  paintList();

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = drop.hidden;
    drop.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      paintList(search?.value || "");
      setTimeout(() => search?.focus(), 40);
    }
  });

  search?.addEventListener("input", () => paintList(search.value));

  const onDoc = (e) => {
    if (!root.querySelector("#cc-picker")?.contains(e.target)) {
      drop.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  };
  document.addEventListener("click", onDoc);
}

function renderOnboarding(panel) {
  const prefill = getState().user?.displayName || "";
  panel.innerHTML = `
    <div class="auth-panel__head">
      <h1 class="auth-panel__title">Set up your profile</h1>
      <p class="auth-panel__sub">Choose how others will find you on Kothiqo.</p>
    </div>
    <div class="auth-form">
      <div class="field">
        <label class="field__label" for="onb-name">Display name</label>
        <input class="field__input" id="onb-name" type="text" maxlength="40" placeholder="Your name" value="${escapeAttr(prefill)}" />
      </div>
      <div class="field">
        <label class="field__label" for="onb-username">Username</label>
        <input class="field__input" id="onb-username" type="text" maxlength="32" placeholder="johndoe" autocomplete="username" />
        <span class="field__hint">3–32 characters · a–z, 0–9, underscore</span>
      </div>
      <div class="field">
        <label class="field__label" for="onb-bio">Bio (optional)</label>
        <textarea class="field__textarea" id="onb-bio" maxlength="160" placeholder="A short introduction"></textarea>
      </div>
      <button type="button" class="btn btn--primary btn--block" id="btn-finish">
        <i class="bi bi-check2-circle"></i> Continue
      </button>
      <p id="auth-error" class="field__error"></p>
    </div>
  `;

  const userEl = panel.querySelector("#onb-username");
  userEl?.addEventListener("input", () => {
    const pos = userEl.selectionStart;
    const n = normalizeUsername(userEl.value);
    if (userEl.value !== n) {
      userEl.value = n;
      const c = Math.max(0, (pos || 0) - 1);
      userEl.setSelectionRange(c, c);
    }
  });

  panel.querySelector("#btn-finish")?.addEventListener("click", async () => {
    const displayName = panel.querySelector("#onb-name")?.value.trim() || "";
    const username = normalizeUsername(panel.querySelector("#onb-username")?.value || "");
    const bio = panel.querySelector("#onb-bio")?.value.trim() || "";
    const errBox = panel.querySelector("#auth-error");
    const btn = panel.querySelector("#btn-finish");
    if (errBox) errBox.textContent = "";
    if (!isValidDisplayName(displayName)) { if (errBox) errBox.textContent = "Enter a display name (1–40 characters)"; return; }
    if (!isValidUsername(username)) { if (errBox) errBox.textContent = "Username must be 3–32 characters, a–z, 0–9, _"; return; }
    if (btn) { btn.disabled = true; btn.innerHTML = "Saving…"; }
    try {
      await completeOnboarding({ displayName, username, bio });
      try {
        const mod = await import("../core/app.js");
        if (typeof mod.refreshShell === "function") mod.refreshShell();
      } catch (_) {
        window.location.hash = "chats";
      }
    } catch (err) {
      if (errBox) errBox.textContent = err.message || "Could not complete setup";
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-check2-circle"></i> Continue`; }
    }
  });
}

function friendlyError(err) {
  if (err?.message && !err.code) return err.message;
  try { return mapAuthError(err); } catch (_) { return err?.message || "Something went wrong"; }
}

function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export default { renderAuth };