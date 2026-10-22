export function saveAndRefresh(write:()=>Promise<void>,refresh:()=>Promise<void>):Promise<{refreshed:boolean}>;
