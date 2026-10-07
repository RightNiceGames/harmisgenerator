'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = {
  label: string;
  scope: ReactNode;
  className?: string;
  children: ReactNode;
  groups: { label: string; content: ReactNode }[];
  parametersOpen: boolean;
  onToggle: () => boolean;
};

/** One row of frequent actions, with one optional group immediately below it. */
export function ScoreToolbar({ label, scope, className = '', children, groups, parametersOpen, onToggle }: Props) {
  const [selectedGroup, setOpen] = useState<number | null>(null);
  const open = parametersOpen ? null : selectedGroup;
  useEffect(() => { if (parametersOpen) setOpen(null); }, [parametersOpen]);
  const id = useId();
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className={`score-action-card score-toolbar ${className}`} role="group" aria-label={label}
    onKeyDown={event => {
      if (event.key !== 'Escape' || open === null || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      if (!onToggle()) return;
      triggers.current[open]?.focus();
      setOpen(null);
    }}>
    <div className="score-scope">{scope}</div>
    <div className="score-toolbar-main">
    <div className="score-action-strip">{children}</div>
    <div className="score-group-toggles">
      {groups.map((group, index) => <button type="button" key={group.label}
        ref={element => { triggers.current[index] = element; }}
        aria-expanded={open === index} aria-controls={`${id}-${index}`}
        onClick={() => { if (onToggle()) setOpen(open === index ? null : index); }}>
        {group.label}<ChevronDown aria-hidden="true"/>
      </button>)}
    </div>
    </div>
    {groups.map((group, index) => <div key={group.label} id={`${id}-${index}`} hidden={open !== index}
      className="score-action-options" role="group" aria-label={group.label}>
      {open === index && group.content}
    </div>)}
  </div>;
}
