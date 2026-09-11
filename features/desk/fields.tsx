'use client';
import { useId } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
export type Option = {
    value: string;
    label: string;
};
export function Pick({ label, value, onChange, options, disabled = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: (string | Option)[];
    disabled?: boolean;
}) { const id = useId(); return <div className="field"><label htmlFor={id}>{label}</label><Select value={value || '__empty'} onValueChange={v => onChange(v === '__empty' ? '' : v)} disabled={disabled}><SelectTrigger id={id} aria-label={label} className="w-full h-10 bg-white"><SelectValue /></SelectTrigger><SelectContent>{options.map(o => { const v = typeof o === 'string' ? o : o.value, l = typeof o === 'string' ? o : o.label; return <SelectItem key={v} value={v || '__empty'}>{l}</SelectItem>; })}</SelectContent></Select></div>; }
export function Field({ label, value, onChange, type = 'text', required = false, placeholder = '', disabled = false }: {
    label: string;
    value: string | number;
    onChange: (s: string) => void;
    type?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
}) { const id = useId(); return <div className="field"><label htmlFor={id}>{label}{required && <span className="required"> *</span>}</label><Input id={id} className="h-10 bg-white" value={value} onChange={e => onChange(e.target.value)} type={type} required={required} placeholder={placeholder} disabled={disabled}/></div>; }
export function Area({ label, value, onChange, placeholder = '' }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
}) { const id = useId(); return <div className="field span-all"><label htmlFor={id}>{label}</label><Textarea id={id} rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/></div>; }
export function Band({ label, value, onChange }: {
    label: string;
    value: number | null;
    onChange: (v: number | null) => void;
}) { return <Pick label={label} value={value == null ? '' : String(value)} onChange={v => onChange(v === '' ? null : Number(v))} options={[{ value: '', label: 'Not set' }, ...Array.from({ length: 19 }, (_, i) => ({ value: String(i / 2), label: (i / 2).toFixed(1) }))]}/>; }
