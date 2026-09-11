'use client';
import { useState } from 'react';
import { FileText, Users, Filter } from 'lucide-react';
import { ActionDialog } from './dialogs';
import { Field, Pick } from './fields';
import { Snapshot, Student } from './model';
import { buildReport } from './report-definition';
export function ReportDialog({ students, data, filters, onClose, demo }: {
    students: Student[];
    data: Snapshot;
    filters: string[];
    onClose: () => void;
    demo: boolean;
}) { const [title, setTitle] = useState('IELTS student report'), [format, setFormat] = useState('summary'); return <ActionDialog title="Export student report" description="The PDF includes every matching student, across all table pages." saveLabel="Download PDF" onClose={onClose} onSave={async () => { if (!students.length)
    throw new Error('No matching students to export.'); const pdfmake = (await import('pdfmake/build/pdfmake')).default; const origin = window.location.origin; pdfmake.addFonts({ Inter: { normal: origin + '/fonts/Inter-Regular.ttf', bold: origin + '/fonts/Inter-Bold.ttf', italics: origin + '/fonts/Inter-Regular.ttf', bolditalics: origin + '/fonts/Inter-Bold.ttf' }, Bengali: { normal: origin + '/fonts/Bengali-Regular.ttf', bold: origin + '/fonts/Bengali-Bold.ttf', italics: origin + '/fonts/Bengali-Regular.ttf', bolditalics: origin + '/fonts/Bengali-Bold.ttf' } }); await pdfmake.createPdf(buildReport(students, data, filters, format === 'detailed', title, demo)).download('HEXA_IELTS_Students_' + new Date().toISOString().slice(0, 10) + '.pdf'); }}><div className="report-summary"><FileText /><div><strong>{students.length} student{students.length === 1 ? '' : 's'}</strong><p>{filters.length ? filters.length + ' active filters' : 'All students'}</p></div></div><div className="form-grid"><Field label="Report title" value={title} onChange={setTitle}/><Pick label="Report format" value={format} onChange={setFormat} options={[{ value: 'summary', label: 'Student list · landscape table' }, { value: 'detailed', label: 'Detailed profiles · all recorded information' }]}/></div><div className="report-filters"><strong>Included filters</strong><p>{filters.length ? filters.join(' · ') : 'No filters applied'}</p></div>{format === 'detailed' && <p className="help">Includes contact information, all course enrollments, previous institutes, module assessments, goals, exam plans, registration details and teacher observations.</p>}{demo && <p className="preview-notice">This report will be marked as sample data.</p>}</ActionDialog>; }
