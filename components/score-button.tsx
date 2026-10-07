import type { ReactNode } from 'react';

export function ScoreButton({label,caption,children,onClick,disabled,active,className=''}:{label:string;caption?:string;children:ReactNode;onClick:()=>void;disabled?:boolean;active?:boolean;className?:string}) {
  return <button type="button" className={`score-icon ${active?'active':''} ${caption?'score-captioned':''} ${className}`} aria-label={label} aria-pressed={active} title={label} data-tooltip={label} disabled={disabled} onClick={onClick}>{children}<span className="score-button-label" aria-hidden="true">{caption??label}</span></button>;
}
