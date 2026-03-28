# AttendEase — Web Admin Portal

**Drushyasinchana Tech Solutions** · drushyasinchana.in

---

## Folder Structure

Upload this entire folder to your web server at:

```
drushyasinchana.in/AttendEase/
```

Final structure on server:

```
AttendEase/
├── index.html              ← Main portal page
├── assets/
│   ├── css/
│   │   └── main.css        ← All styles
│   └── js/
│       └── app.js          ← All application logic
└── README.md               ← This file
```

---

## Logo

The portal pulls your logo automatically from:
```
https://drushyasinchana.in/assets/images/logo.png
```
No separate image files needed. All logo references point to your main site.

---

## Apps Script Actions Required

Your Google Apps Script must handle these `action` values:

| Action | Used in |
|---|---|
| `login` | Login screen |
| `getEmployees` | Dashboard, Employee page |
| `registerEmployee` | Employee modal |
| `updateEmployee` | Employee edit modal |
| `getSites` | Dashboard, Sites page |
| `addSite` | Site modal |
| `updateSite` | Site edit modal |
| `getAttendance` | Attendance page, Dashboard |
| `getAttendanceRange` | Reports page |
| `markAttendance` | Manual entry |

### `getAttendanceRange` — add this to your script

```javascript
case 'getAttendanceRange': {
  const { fromDate, toDate, siteId, empCode } = data;
  // Loop through monthly sheets between fromDate and toDate
  // Filter by siteId and empCode if provided
  // Return { success: true, data: { records: [...] } }
  break;
}
```

---

## Changing the Script URL

Open `assets/js/app.js` and update line 5:

```javascript
const SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

---

## Access

- URL: `https://drushyasinchana.in/AttendEase/`
- Admin login only (employees are blocked with a message)
- Passwords are SHA-256 hashed in the browser before sending
