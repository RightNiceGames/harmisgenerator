import { useState } from 'react';

const commonMeters = ['2/4','3/4','4/4','5/4','7/4','6/8','7/8','9/8','12/8'];

export function MeterPicker({value,meter,onChange,onCommit}:{value:string;meter:string;onChange:(value:string)=>void;onCommit:(input:HTMLInputElement)=>void}) {
  const [custom,setCustom] = useState(false);
  const isCustom = custom || !!value && !commonMeters.includes(value);
  return <>
    <label className="score-field">Taktart
      <select aria-label="Taktart i takten" value={isCustom?'custom':value} onChange={event=>{
        if(event.target.value==='custom')setCustom(true);
        else {setCustom(false);onChange(event.target.value);}
      }}>
        <option value="">Inget byte</option>
        {commonMeters.map(item=><option key={item} value={item}>{item}</option>)}
        <option value="custom">Annan taktart…</option>
      </select>
    </label>
    {isCustom&&<label className="score-field">Egen taktart
      <input aria-label="Egen taktart i takten" key={value} defaultValue={value} placeholder={meter} autoFocus onBlur={event=>onCommit(event.currentTarget)}/>
      <span className="score-hint">Skriv till exempel 5/8 eller 11/8.</span>
    </label>}
  </>;
}
