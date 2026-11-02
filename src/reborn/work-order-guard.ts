/** Normal terrain right-clicks must not silently replace assigned work.
 * Explicit Move (M or Alt+right-click), Stop, and a new target order are authoritative. */
export function preserveAssignedWork(current:string|undefined,next:string,append:boolean,explicitMove=false):boolean{
 return !append&&!explicitMove&&next==='move'&&(current==='build'||current==='repair');
}
