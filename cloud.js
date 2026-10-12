/* RuangKinerja cloud UI. Requires config.js with SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. */
const $=id=>document.getElementById(id);
const criteria=[["discipline","Disiplin"],["quality","Kualitas kerja"],["productivity","Produktivitas"],["teamwork","Kerja sama"],["initiative","Inisiatif"]];
let sb,user,profile,employees=[],coordinators=[],allProfiles=[];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function msg(t,err=false){$("notice").textContent=t;$("notice").classList.remove("hidden");$("notice").classList.toggle("error",err);}
function fail(e){console.error(e);msg(e?.message||"Terjadi kesalahan. Periksa konfigurasi dan kebijakan database.",true);}
function el(tag,attrs={},text=""){const x=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>x.setAttribute(k,v));x.textContent=text;return x;}
async function boot(){
 if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY){msg("Konfigurasi belum lengkap. Isi config.js sesuai panduan.",true);return;}
 sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
 $("google").onclick=async()=>{const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname,queryParams:{access_type:"offline",prompt:"select_account"}}});if(error)fail(error);};
 $("signout").onclick=async()=>{await sb.auth.signOut();location.reload();};
 $("employeeForm").onsubmit=addEmployee;$("assignForm").onsubmit=assignEmployee;$("evalForm").onsubmit=submitEvaluation;
 criteria.forEach(([k,label])=>{$("ratings").insertAdjacentHTML("beforeend",`<div class="score"><label for="r_${k}">${label}</label><select id="r_${k}" required><option value="">Pilih nilai</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} — ${["","Perlu perbaikan","Kurang","Cukup","Baik","Sangat baik"][n]}</option>`).join("")}</select></div>`);});
 $("evalDate").value=new Date().toISOString().slice(0,10);
 const {data:{session}}=await sb.auth.getSession();await renderSession(session);
 sb.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>renderSession(session),0);});
}
async function renderSession(session){
 $("login").classList.toggle("hidden",!!session);$("pending").classList.add("hidden");$("app").classList.add("hidden");$("signout").classList.toggle("hidden",!session);
 if(!session){$("who").textContent="";return;}
 user=session.user;$("who").textContent=user.email||"";
 let {data:p,error}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(error){fail(error);return;}profile=p;
 if(!profile){msg("Profil belum terbentuk. Muat ulang halaman beberapa saat lagi.",true);return;}
 if(profile.role==="admin"&&profile.status==="approved"){await loadAdmin();return;}
 if(profile.status!=="approved"){$("pending").classList.remove("hidden");return;}
 $("app").classList.remove("hidden");$("admin").classList.add("hidden");await loadCoordinator();
}
async function loadAdmin(){
 $("app").classList.remove("hidden");$("admin").classList.remove("hidden");$("employeeHeading").textContent="Semua karyawan";$("evalHeading").textContent="Kirim penilaian (admin)";
 const [pr,er,as]=await Promise.all([sb.from("profiles").select("*").order("created_at",{ascending:false}),sb.from("employees").select("*").order("name"),sb.from("employee_assignments").select("*")]);
 if(pr.error||er.error||as.error){fail(pr.error||er.error||as.error);return;}
 allProfiles=pr.data;employees=er.data;coordinators=allProfiles.filter(p=>p.role==="coordinator"&&p.status==="approved");
 $("profiles").innerHTML=allProfiles.filter(p=>p.role==="coordinator").map(p=>`<div class="item"><strong>${esc(p.email)}</strong> <span class="pill">${esc(p.status)}</span><div class="row" style="margin-top:8px">${p.status!=="approved"?`<button data-approve="${p.id}">Setujui</button>`:""}${p.status!=="rejected"?`<button class="secondary" data-reject="${p.id}">Tolak/cabut akses</button>`:""} </div></div>`).join("")||'<p class="muted">Belum ada pendaftar.</p>';
 $("profiles").querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>setProfile(b.dataset.approve,"approved"));
 $("profiles").querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>setProfile(b.dataset.reject,"rejected"));
 fillSelect($("assignEmployee"),employees,"Pilih karyawan",e=>e.name);fillSelect($("assignCoordinator"),coordinators,"Pilih koordinator",p=>p.email);
 $("assignments").innerHTML=as.data.map(a=>{let e=employees.find(x=>x.id===a.employee_id),p=allProfiles.find(x=>x.id===a.coordinator_id);return `<div class="item">${esc(e?.name||"Karyawan")} → ${esc(p?.email||"Koordinator")} <button class="danger" data-unassign="${a.employee_id}|${a.coordinator_id}">Hapus penugasan</button></div>`}).join("")||'<p class="muted">Belum ada penugasan.</p>';
 $("assignments").querySelectorAll("[data-unassign]").forEach(b=>b.onclick=async()=>{let [employee_id,coordinator_id]=b.dataset.unassign.split("|");let {error}=await sb.from("employee_assignments").delete().match({employee_id,coordinator_id});if(error)fail(error);else loadAdmin();});
 $("employeeList").innerHTML=employees.map(e=>`<div class="item"><strong>${esc(e.name)}</strong> · ${esc(e.department)} <span class="muted">${esc(e.code)}</span><button class="danger" data-del-emp="${e.id}">Hapus</button></div>`).join("")||'<p class="muted">Belum ada data karyawan.</p>';
 $("employeeList").querySelectorAll("[data-del-emp]").forEach(b=>b.onclick=async()=>{if(!confirm("Hapus karyawan dan penugasannya?"))return;let {error}=await sb.from("employees").delete().eq("id",b.dataset.delEmp);if(error)fail(error);else loadAdmin();});
 const {data:ev,error:ee}=await sb.from("evaluations").select("*, employees(name)").order("created_at",{ascending:false});if(ee){fail(ee);return;}
 $("allEvaluations").innerHTML=ev.map(renderEvaluation).join("")||'<p class="muted">Belum ada penilaian.</p>';
 $("allEvaluations").querySelectorAll("[data-delete-eval]").forEach(b=>b.onclick=async()=>{if(!confirm("Hapus penilaian ini?"))return;let {error}=await sb.from("evaluations").delete().eq("id",b.dataset.deleteEval);if(error)fail(error);else loadAdmin();});
 $("allEvaluations").querySelectorAll("[data-edit-eval]").forEach(b=>b.onclick=()=>editEvaluation(b.dataset.editEval,ev));
 await loadEmployeeSelect();
}
async function setProfile(id,status){let patch={status};if(status==="approved"){patch.approved_at=new Date().toISOString();patch.approved_by=user.id;}else{patch.approved_at=null;patch.approved_by=null;}const {error}=await sb.from("profiles").update(patch).eq("id",id);if(error)fail(error);else{msg("Status akun diperbarui.");loadAdmin();}}
async function addEmployee(e){e.preventDefault();const {error}=await sb.from("employees").insert({name:$("empName").value.trim(),code:$("empCode").value.trim(),department:$("empDept").value.trim(),created_by:user.id});if(error)fail(error);else{$("employeeForm").reset();msg("Karyawan ditambahkan.");loadAdmin();}}
async function assignEmployee(e){e.preventDefault();const {error}=await sb.from("employee_assignments").insert({employee_id:$("assignEmployee").value,coordinator_id:$("assignCoordinator").value,assigned_by:user.id});if(error)fail(error);else{msg("Penugasan disimpan.");loadAdmin();}}
async function loadCoordinator(){const {data,error}=await sb.from("employees").select("*").order("name");if(error){fail(error);return;}employees=data;await loadEmployeeSelect();$("employeeList").innerHTML=employees.map(e=>`<div class="item"><strong>${esc(e.name)}</strong><div class="muted">${esc(e.department||"")}</div></div>`).join("")||'<p class="muted">Belum ada karyawan yang ditugaskan. Hubungi admin.</p>';const {data:ev,error:ee}=await sb.from("evaluations").select("*, employees(name)").eq("evaluator_id",user.id).order("created_at",{ascending:false});if(ee){fail(ee);return;}$("myEvaluations").innerHTML=ev.map(renderEvaluation).join("")||'<p class="muted">Belum ada penilaian.</p>';}
async function loadEmployeeSelect(){fillSelect($("evalEmployee"),employees,"Pilih karyawan",e=>e.name);}
function fillSelect(select,items,placeholder,label){select.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(i=>`<option value="${i.id}">${esc(label(i))}</option>`).join("");}
async function submitEvaluation(e){e.preventDefault();const ratings={};for(const [k] of criteria){const v=$("r_"+k).value;if(!v){msg("Lengkapi semua nilai indikator.",true);return;}ratings[k]=Number(v);}
const employee=employees.find(x=>x.id===$("evalEmployee").value);const {error}=await sb.from("evaluations").insert({employee_id:$("evalEmployee").value,evaluator_id:user.id,evaluator_name:user.email,period:$("period").value.trim(),evaluation_date:$("evalDate").value,ratings,notes:$("notes").value.trim(),status:"completed"});
if(error)fail(error);else{$("evalForm").reset();$("evalDate").value=new Date().toISOString().slice(0,10);msg("Penilaian berhasil dikirim dan tersimpan.");if(profile.role==="admin")loadAdmin();else loadCoordinator();}}
function renderEvaluation(e){let scores=Object.entries(e.ratings||{}).map(([k,v])=>`${esc(criteria.find(c=>c[0]===k)?.[1]||k)}: ${esc(v)}`).join(" · ");return `<div class="item"><h3>${esc(e.employees?.name||"Karyawan")} — ${esc(e.period)}</h3><div class="muted">${esc(e.evaluator_name)} · ${esc(e.evaluation_date)}</div><p>${scores}</p><p>${esc(e.notes||"Tidak ada catatan")}</p>${profile?.role==="admin"?`<div class="row"><button class="secondary" data-edit-eval="${e.id}">Edit catatan/nilai</button><button class="danger" data-delete-eval="${e.id}">Hapus</button></div>`:""}</div>`;}
async function editEvaluation(id,items){let e=items.find(x=>x.id===id);if(!e)return;let notes=prompt("Edit catatan penilaian:",e.notes||"");if(notes===null)return;let ratings={...e.ratings};for(const [k,label] of criteria){let v=prompt(`Nilai ${label} (1-5):`,ratings[k]??"");if(v===null)return;if(!/^[1-5]$/.test(v)){alert("Nilai harus 1 sampai 5.");return;}ratings[k]=Number(v);}const {error}=await sb.from("evaluations").update({notes,ratings,updated_at:new Date().toISOString()}).eq("id",id);if(error)fail(error);else{msg("Penilaian diperbarui.");loadAdmin();}}
boot().catch(fail);
