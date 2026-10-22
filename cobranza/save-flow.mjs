// A committed write must never become a failed write just because its read-back failed.
export async function saveAndRefresh(write,refresh){
 await write();
 try{await refresh();return {refreshed:true};}
 catch{return {refreshed:false};}
}
