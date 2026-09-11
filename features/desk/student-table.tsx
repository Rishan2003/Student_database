'use client';
import { useMemo, useState, useEffect } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Student, Snapshot, MODULES, latestAssessment, examDate, dateLabel, intakeLabel, registrationNames, isOverdue } from './model';
export function StudentTable({ students, data, onOpen, onReset }: {
    students: Student[];
    data: Snapshot;
    onOpen: (s: Student) => void;
    onReset: () => void;
}) {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    useEffect(() => setPagination(p => ({ ...p, pageIndex: 0 })), [students]);
    const columns = useMemo<ColumnDef<Student>[]>(() => [
        { id: 'name', header: 'Student', cell: ({ row: { original: s } }) => <button className="student-link" onClick={() => onOpen(s)}><span className="avatar">{s.full_name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span><strong>{s.full_name}</strong><small>{s.primary_phone}</small><small className="student-code">{s.student_code}</small></span></button> },
        { id: 'batch', header: 'Course / batch', cell: ({ row: { original: s } }) => { const active = s.enrollments.filter(e => ['active', 'enrolled'].includes(e.status)); const enrollments = active.length ? active : s.enrollments; return <div className="course-cell">{enrollments.slice(0, 2).map(e => { const b = data.batches.find(b => b.id === e.batch_id), c = data.courses.find(c => c.id === b?.course_type_id); return <span key={e.id}><strong>{c?.name || 'Previous course'}</strong><small>{b?.batch_code || 'Previous batch'}</small></span>; })}{!enrollments.length && <small>No enrollment</small>}{enrollments.length > 2 && <small>+{enrollments.length - 2} more</small>}</div>; } },
        { id: 'levels', header: () => <span title="Staff-assessed levels from 1 to 5">Module levels <small className="muted">/5</small></span>, cell: ({ row: { original: s } }) => <div className="mini-levels">{MODULES.map(m => <span title={m} className={'level-' + (latestAssessment(s)?.levels[m] || 0)} key={m}><small>{m[0].toUpperCase()}</small><b>{latestAssessment(s)?.levels[m] ?? '—'}</b></span>)}</div> },
        { id: 'target', header: 'Target', cell: ({ row: { original: s } }) => <strong className="target-band">{s.goal.target_overall?.toFixed(1) || '—'}</strong> },
        { id: 'destination', header: 'Destination / intake', cell: ({ row: { original: s } }) => <div className="two-lines"><strong>{s.goal.destination_country || 'Not set'}</strong><small>{intakeLabel(s.goal.intended_intake)}</small></div> },
        { id: 'exam', header: 'Main test', cell: ({ row: { original: s } }) => <div className="two-lines"><strong>{examDate(s) ? dateLabel(examDate(s)) : s.plan.intended_exam_month ? intakeLabel(s.plan.intended_exam_month) : 'Not planned'}</strong><small>{s.plan.actual_exam_date ? 'Confirmed' : examDate(s) || s.plan.intended_exam_month ? 'Intended date' : ''}</small></div> },
        { id: 'registration', header: 'Registration', cell: ({ row: { original: s } }) => <div className="two-lines"><span className={'status-badge ' + (isOverdue(s) ? 'overdue' : s.plan.registration_status)}>{isOverdue(s) ? 'Overdue' : registrationNames[s.plan.registration_status]}</span><small>{s.plan.registration_status === 'registered' ? dateLabel(s.plan.actual_registration_date) : s.plan.promised_registration_date ? 'Due ' + dateLabel(s.plan.promised_registration_date) : ''}</small></div> },
        { id: 'open', header: '', cell: ({ row: { original: s } }) => <Button variant="ghost" size="icon" aria-label={'Open ' + s.full_name} onClick={() => onOpen(s)}><ArrowUpRight size={16}/></Button> }
    ], [data, onOpen]);
    const table = useReactTable({ data: students, columns, state: { pagination }, onPaginationChange: setPagination, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() });
    if (!students.length)
        return <Empty className="table-empty"><EmptyHeader><EmptyTitle>No students found</EmptyTitle><EmptyDescription>{data.students.length ? 'Try a different search or clear your filters.' : 'Create a course and batch, then add your first student.'}</EmptyDescription></EmptyHeader>{data.students.length > 0 && <Button variant="outline" onClick={onReset}>Clear filters</Button>}</Empty>;
    return <><Table className="student-table"><TableHeader>{table.getHeaderGroups().map(h => <TableRow key={h.id}>{h.headers.map(x => <TableHead key={x.id}>{flexRender(x.column.columnDef.header, x.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map(r => <TableRow key={r.original.id}>{r.getVisibleCells().map(c => <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table><div className="table-footer"><span>Showing {pagination.pageIndex * 10 + 1}–{Math.min((pagination.pageIndex + 1) * 10, students.length)} of {students.length} students</span><div className="page-controls"><Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button><span>Page {pagination.pageIndex + 1} of {table.getPageCount()}</span><Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button></div></div></>;
}
