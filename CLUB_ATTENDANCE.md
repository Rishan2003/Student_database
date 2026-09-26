# Daily club attendance

## After each club

1. Take a clear photo of the attendance sheet. Include the names as written and batch numbers.
2. Open **Club attendance → Import club sheet → Get text from a sheet photo**. Copy the AI prompt, attach the photo to your preferred AI, and ask it to extract the sheet.
3. In the app, choose the **campus, module and session date**. Paste the extracted text, or open a `.txt` / `.json` file.
4. Select **Check matches**. Check names against the original sheet. For an unclear row, choose the correct student from the list or explicitly choose **Skip this row**. Student codes and enrollment dates help distinguish matching names.
5. Select **Save students**. Attendance is saved in the same Supabase database as the student records.

The app accepts a simple two-column list, one student per line:

```text
Student name | Batch number
Ayesha Rahman | HICU-301
Farhan Ahmed | 299
```

Or a JSON array:

```json
[
  {"name": "Ayesha Rahman", "batch": "HICU-301"},
  {"name": "Farhan Ahmed", "batch": "299"}
]
```

These are examples; replace them with names and batch codes from your sheet. Keep course prefixes when they are written on the sheet. Bengali batch digits are accepted. Tab-separated columns also work. Choose the date and module in the form, outside the pasted text.

## Before class

Open **Batches**, find your batch, and select **Club attendance**. Use **Today**, **Yesterday**, or the date field. The table shows Listening, Reading, Writing and Speaking attendance for each student. Select **Refresh** if a colleague has just imported a sheet.

An **Attended** entry means attendance was saved. **Not listed** means the student's attendance has not been recorded for an imported club sheet. A dash means no sheet has been imported for that module. Neither implies a confirmed absence.

Attendance follows the student: a student enrolled in two batches appears as attended in either batch, even if the sign-in sheet listed only one of them. The view remains scoped to the selected campus and date.

## Checking and correcting

- The app automatically matches only a unique name-and-batch pair. First names and consecutive parts of a full name are accepted only when exactly one enrollment matches. Check the displayed full name before saving. Misspellings and unclear text require a manual choice.
- Batch variations such as `PRE-122`, `122 (PRE)`, `pre 122`, and `122` are accepted. Explicit course prefixes are respected; a number alone may require a manual choice across courses.
- If two students have the same name and batch number, select the correct student using their full batch code and permanent student code. Check with staff when necessary.
- A skipped row is not saved. You can resolve it and import it later.
- Re-importing the same sheet is safe: each student is counted once per campus, module and day. Additional sheets add attendees without replacing earlier entries.
- To fix a saved mistake, select the student's **Attended** entry and remove it, then import the corrected entry. Import and correction actions are logged.
- Students must already exist in the database with an enrollment by the club date. This feature does not create student profiles from handwriting.
- Previous attendance is retained when an enrollment is completed or transferred. The sign-in enrollment is kept with the attendance record.

## Staff access

Super administrators, branch managers, academic coordinators, teachers and front-desk staff can import and correct club attendance at campuses they can access. The import matcher provides names, student codes and batch details across that campus, because clubs include many batches. It does not expose other batches' contact details, goals or assessments.

The batch attendance view uses existing student-access rules. A teacher sees attendance for their own students, including attendance entered under another enrollment. Viewers and counselors can read attendance within their existing access but cannot import or correct it. Inactive accounts cannot use attendance data.

## AI extraction prompt

```text
Read this club attendance sheet. Transcribe every student row in the same order. Return ONLY a JSON array in this format:
[{"name":"Student full name","batch":"Batch code or number"}]
Copy names and batch codes exactly as written, including course prefixes. Do not guess, correct spelling, add students, or merge similar names. Use an empty string for an unreadable name or batch so I can check it. Exclude headings, dates, signatures and serial numbers. Do not include explanations or markdown.
```

Photo reading happens in the AI you choose. This app imports the resulting text; no AI key or paid image-processing service is required inside the app. The app does not send student records or photos to an AI automatically.

See **UPDATE_NOTES.md** for the one-time database migration before deploying this version.
