/* USMAN YOBE COMMUNITY ADVANCED FEATURES — additive client module */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>typeof window.esc==='function'?window.esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db=()=>window.db;
const user=()=>window.communityUser;
const status=(s,bad=false)=>{let e=$('uyAdvancedStatus');if(e){e.textContent=s;e.style.color=bad?'#b42318':'#087443';}};
function panel(){
 const hub=$('socialPlatformHub');if(!hub||$('uyAdvancedPanel'))return;
 const el=document.createElement('section');el.id='uyAdvancedPanel';el.className='community-panel';
 el.innerHTML=`
 <h3>✨ Ƙarin Ayyukan Community</h3>
 <div class="social-hub-tabs">
 <button type="button" data-tab="events">📅 Events</button><button type="button" data-tab="saved">🔖 Saved</button><button type="button" data-tab="memories">🕰 Memories</button><button type="button" data-tab="privacy">🔐 Privacy</button><button type="button" data-tab="security">🛡 Tsaro</button>
 </div>
 <div id="uyAdvancedStatus" class="community-muted" role="status">Zaɓi wani sashe.</div>
 <section data-pane="events" style="display:none"><h4>Ƙirƙiri Event</h4><input id="uyEventTitle" class="community-input" maxlength="120" placeholder="Sunan taro"><input id="uyEventVenue" class="community-input" maxlength="180" placeholder="Wurin taro"><input id="uyEventTime" class="community-input" type="datetime-local"><textarea id="uyEventDescription" class="community-input" maxlength="1500" placeholder="Bayani da gayyata"></textarea><select id="uyEventVisibility" class="community-input"><option value="public">Kowa zai gani</option><option value="private">Ni kaɗai</option></select><button class="community-btn" id="uyCreateEvent">＋ Ƙirƙiri Event</button><div id="uyEventsList"></div></section>
 <section data-pane="saved" style="display:none"><h4>Abubuwan da ka adana</h4><div id="uySavedList"></div></section>
 <section data-pane="memories" style="display:none"><h4>Memories – tsoffin posts</h4><div id="uyMemoriesList"></div></section>
 <section data-pane="privacy" style="display:none"><h4>Privacy Settings</h4><label>Wanda zai ga sabbin posts</label><select id="uyAudience" class="community-input"><option value="public">Public – Kowa</option><option value="friends">Friends – Abokai</option><option value="private">Only me – Ni kaɗai</option></select><label><input id="uyShowOnline" type="checkbox" checked> Nuna lokacin da nake online</label><br><label><input id="uyAllowRequests" type="checkbox" checked> Karɓar friend requests</label><br><button class="community-btn" id="uySavePrivacy">Ajiye privacy</button><p class="community-muted">Wannan yana adana zaɓin sirrinka. Aiwatar da audience ga tsoffin posts yana buƙatar ƙara audience column da RLS zuwa forum_posts.</p></section>
 <section data-pane="security" style="display:none"><h4>Tsaro</h4><p class="community-muted">Two-factor authentication (2FA) ta Supabase Auth.</p><button class="community-btn" id="uyMfaEnroll">Kunna 2FA (Authenticator)</button><div id="uyMfaBox"></div><p class="community-muted">Yi amfani da Report idan ka ga zamba, spam, cin zarafi ko fake account.</p><div id="uyModerationPanel" style="display:none"><h4>🛡 Rahotannin mambobi</h4><button class="community-btn secondary" id="uyLoadReports">Duba reports</button><div id="uyReportsList"></div></div></section>`;
 hub.appendChild(el);
 el.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
 $('uyCreateEvent').addEventListener('click',createEvent);
 $('uySavePrivacy').addEventListener('click',savePrivacy);
 $('uyMfaEnroll').addEventListener('click',enrollMfa);
 if(window.communityIsAdmin){$('uyModerationPanel').style.display='block';$('uyLoadReports').addEventListener('click',loadReports);}
}
async function openTab(tab){
 document.querySelectorAll('#uyAdvancedPanel [data-pane]').forEach(p=>p.style.display=p.dataset.pane===tab?'block':'none');
 status('Ana loda bayanai...');
 if(tab==='events')await loadEvents();
 if(tab==='saved')await loadSaved();
 if(tab==='memories')await loadMemories();
 if(tab==='privacy')await loadPrivacy();
}
async function createEvent(){
 if(!user()){status('Shiga account kafin ƙirƙirar event.',true);return;}
 const title=$('uyEventTitle').value.trim(),starts=$('uyEventTime').value;
 if(!title||!starts){status('Cika sunan event da lokaci.',true);return;}
 const {error}=await db().from('social_events').insert({host_id:user().id,title,venue:$('uyEventVenue').value.trim(),starts_at:new Date(starts).toISOString(),description:$('uyEventDescription').value.trim(),visibility:$('uyEventVisibility').value});
 if(error){status('Ba a ƙirƙiri event ba: '+error.message,true);return;}
 ['uyEventTitle','uyEventVenue','uyEventTime','uyEventDescription'].forEach(id=>$(id).value='');status('An ƙirƙiri event cikin nasara.');loadEvents();
}
async function loadEvents(){
 const box=$('uyEventsList');if(!user()){box.textContent='Shiga account.';return;}
 const {data,error}=await db().from('social_events').select('id,host_id,title,description,venue,starts_at,visibility').order('starts_at',{ascending:true}).limit(40);
 if(error){box.textContent='Database migration bai gama ba: '+error.message;return;}
 box.innerHTML=(data||[]).map(e=>`<article class="social-hub-card"><b>${esc(e.title)}</b><p>${esc(e.description||'')}</p><small>📍 ${esc(e.venue||'Ba a saka wuri ba')} · ${esc(new Date(e.starts_at).toLocaleString())}</small><p><button class="community-btn secondary" data-rsvp="${e.id}" data-response="going">Zan halarta</button> <button class="community-btn secondary" data-rsvp="${e.id}" data-response="interested">Ina sha'awa</button> <button class="community-btn secondary" data-report="${e.id}" data-type="event">Report</button></p></article>`).join('')||'<p>Babu Events tukuna.</p>';
 box.querySelectorAll('[data-rsvp]').forEach(b=>b.addEventListener('click',()=>rsvp(b.dataset.rsvp,b.dataset.response)));
 box.querySelectorAll('[data-report]').forEach(b=>b.addEventListener('click',()=>report(b.dataset.type,b.dataset.report)));
}
async function rsvp(id,response){
 const {error}=await db().from('social_event_rsvps').upsert({event_id:id,user_id:user().id,response},{onConflict:'event_id,user_id'});
 status(error?'RSVP ya kasa: '+error.message:'An adana amsar gayyatarka.',!!error);
}
async function saveItem(type,id){
 if(!user()){alert('Shiga account domin adanawa.');return;}
 const {error}=await db().from('community_saved_items').upsert({user_id:user().id,item_type:type,item_id:String(id)},{onConflict:'user_id,item_type,item_id'});
 if(error)alert('Ba a adana ba: '+error.message);else alert('An adana cikin Saved.');
}
async function removeSaved(type,id){
 const {error}=await db().from('community_saved_items').delete().eq('user_id',user().id).eq('item_type',type).eq('item_id',String(id));
 if(error){status('Ba a cire abin daga Saved ba: '+error.message,true);return;}
 status('An cire abin daga Saved.');await loadSaved();
}
async function loadSaved(){
 const box=$('uySavedList');if(!user()){box.textContent='Shiga account.';return;}
 const {data,error}=await db().from('community_saved_items').select('item_type,item_id,created_at').eq('user_id',user().id).order('created_at',{ascending:false}).limit(100);
 if(error){box.textContent='Database migration bai gama ba: '+error.message;return;}
 const rows=data||[],postIds=rows.filter(x=>x.item_type==='post').map(x=>x.item_id);
 let posts=[];
 if(postIds.length){
  const result=await db().from('forum_posts').select('id,content,media_url,media_type,created_at').in('id',postIds);
  if(!result.error)posts=result.data||[];
 }
 const postMap=new Map(posts.map(p=>[String(p.id),p]));
 box.innerHTML=rows.map(x=>{
  const p=x.item_type==='post'?postMap.get(String(x.item_id)):null;
  const preview=p?'<p>'+esc(p.content||'')+'</p>'+(p.media_url?(p.media_type==='video'?'<video controls playsinline preload="metadata" style="width:100%;max-height:220px" src="'+esc(p.media_url)+'"></video>':'<img loading="lazy" style="width:100%;max-height:220px;object-fit:contain" src="'+esc(p.media_url)+'" alt="Saved post">'):''):'<p>Abu ne: '+esc(x.item_type)+' · ID: '+esc(x.item_id)+'</p>';
  return '<article class="social-hub-card"><b>🔖 '+esc(x.item_type)+'</b>'+preview+'<small>'+esc(new Date(x.created_at).toLocaleDateString())+'</small> <button class="community-btn secondary" data-remove-type="'+esc(x.item_type)+'" data-remove-id="'+esc(x.item_id)+'">Cire daga Saved</button></article>';
 }).join('')||'<p>Babu abin da aka adana tukuna.</p>';
 box.querySelectorAll('[data-remove-type]').forEach(b=>b.addEventListener('click',()=>removeSaved(b.dataset.removeType,b.dataset.removeId)));
}
async function loadMemories(){
 const box=$('uyMemoriesList');if(!user()){box.textContent='Shiga account.';return;}
 const cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-1);
 const {data,error}=await db().from('forum_posts').select('id,user_id,author_name,content,media_url,media_type,created_at').eq('user_id',user().id).lt('created_at',cutoff.toISOString()).order('created_at',{ascending:false}).limit(30);
 if(error){box.textContent='Ba a iya loda Memories: '+error.message;return;}
 box.innerHTML=(data||[]).map(p=>`<article class="social-hub-card"><b>🕰 A wannan rana a baya</b><p>${esc(p.content||'')}</p><small>${esc(new Date(p.created_at).toLocaleDateString())}</small><button class="community-btn secondary" data-save="${esc(p.id)}">🔖 Save</button></article>`).join('')||'<p>Babu tsoffin posts na shekara guda tukuna.</p>';
 box.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>saveItem('post',b.dataset.save)));
}
async function loadPrivacy(){
 const {data,error}=await db().from('community_privacy_settings').select('*').eq('user_id',user().id).maybeSingle();
 if(error){status('Privacy table bai shirya ba: '+error.message,true);return;}
 if(data){$('uyAudience').value=data.default_post_audience;$('uyShowOnline').checked=data.show_online;$('uyAllowRequests').checked=data.allow_friend_requests;}
}
async function savePrivacy(){
 const row={user_id:user().id,default_post_audience:$('uyAudience').value,show_online:$('uyShowOnline').checked,allow_friend_requests:$('uyAllowRequests').checked,updated_at:new Date().toISOString()};
 const {error}=await db().from('community_privacy_settings').upsert(row,{onConflict:'user_id'});
 status(error?'Ba a ajiye privacy ba: '+error.message:'An ajiye privacy settings.',!!error);
}
async function report(type,id){
 if(!user()){alert('Shiga account domin yin report.');return;}
 const reason=prompt('Dalilin report: spam, fake_account, harassment, scam, inappropriate, other');
 const allowed=['spam','fake_account','harassment','scam','inappropriate','other'];if(!allowed.includes(reason))return;
 const details=prompt('Ƙarin bayani (optional):')||'';
 const {error}=await db().from('community_content_reports').insert({reporter_id:user().id,target_type:type,target_id:String(id),reason,details:details.slice(0,1000)});
 alert(error?(error.code==='23505'?'Ka riga ka yi report kan wannan abu.':'Report ya kasa: '+error.message):'An aika rahoto. Moderators za su duba.');
}
async function loadReports(){
 const box=$('uyReportsList');if(!window.communityIsAdmin){box.textContent='Admins kawai.';return;}
 box.textContent='Ana loda rahotanni...';
 const {data,error}=await db().from('community_content_reports').select('id,reporter_id,target_type,target_id,reason,details,status,created_at').in('status',['pending','reviewing']).order('created_at',{ascending:false}).limit(100);
 if(error){box.textContent='Ba a iya loda reports: '+error.message;return;}
 box.innerHTML=(data||[]).map(r=>'<article class="social-hub-card"><b>'+esc(r.reason)+' · '+esc(r.target_type)+'</b><p>Abu: '+esc(r.target_id)+'</p><p>'+esc(r.details||'Babu ƙarin bayani')+'</p><small>Mai rahoto: '+esc(String(r.reporter_id).slice(0,8))+' · '+esc(new Date(r.created_at).toLocaleString())+' · '+esc(r.status)+'</small><p><button class="community-btn secondary" data-report-id="'+esc(r.id)+'" data-next="reviewing">Duba</button> <button class="community-btn" data-report-id="'+esc(r.id)+'" data-next="resolved">Warware</button> <button class="community-btn secondary" data-report-id="'+esc(r.id)+'" data-next="dismissed">Yi watsi</button></p></article>').join('')||'<p>Babu rahotanni da ke jiran dubawa.</p>';
 box.querySelectorAll('[data-report-id]').forEach(b=>b.addEventListener('click',()=>updateReport(b.dataset.reportId,b.dataset.next)));
}
async function updateReport(id,next){
 if(!window.communityIsAdmin||!['reviewing','resolved','dismissed'].includes(next))return;
 const {error}=await db().from('community_content_reports').update({status:next}).eq('id',id);
 if(error){status('Ba a sabunta rahoton ba: '+error.message,true);return;}
 status('An sabunta matsayin rahoto.');await loadReports();
}
async function enrollMfa(){
 if(!user()){status('Shiga account.',true);return;}
 const auth=db().auth;
 if(!auth.mfa){status('Supabase MFA API bai samu ba. Duba SDK version.',true);return;}
 const {data,error}=await auth.mfa.enroll({factorType:'totp',friendlyName:'USMAN YOBE Authenticator'});
 if(error){status('Ba a kunna 2FA ba: '+error.message,true);return;}
 const box=$('uyMfaBox');
 box.innerHTML='<p>Scan QR code da authenticator app, sannan shigar da lambar da ta samar.</p><div id="uyMfaQr"></div><input id="uyMfaCode" class="community-input" inputmode="numeric" placeholder="6-digit code" maxlength="6"><button class="community-btn" id="uyVerifyMfa">Tabbatar da 2FA</button>';
 if(data.totp?.qr_code)$('uyMfaQr').innerHTML=data.totp.qr_code;
 $('uyVerifyMfa').addEventListener('click',async()=>{
  const {data:challenge,error:ce}=await auth.mfa.challenge({factorId:data.id});if(ce){status(ce.message,true);return;}
  const {error:ve}=await auth.mfa.verify({factorId:data.id,challengeId:challenge.id,code:$('uyMfaCode').value.trim()});
  status(ve?'Ba a tabbatar ba: '+ve.message:'An tabbatar da 2FA. Ka kiyaye authenticator ɗinka.',!!ve);
 });
 status('An fara saitin 2FA. Kammala tabbatarwa a ƙasa.');
}
function addFeedActions(){
 const feed=$('communityFeed');if(!feed)return;
 feed.querySelectorAll('[id^="communityPost_"]').forEach(card=>{
  if(card.querySelector('[data-uy-save]'))return;
  const id=card.id.replace('communityPost_','');if(!id)return;
  const bar=document.createElement('div');bar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:8px 0';
  const save=document.createElement('button');save.className='community-btn secondary';save.textContent='🔖 Save';save.dataset.uySave='1';save.addEventListener('click',()=>saveItem('post',id));
  bar.append(save);card.appendChild(bar);
 });
}
async function optimizeSelectedImage(input){
 const file=input.files?.[0];if(!file||!file.type.startsWith('image/')||file.size<700*1024)return;
 if(!window.createImageBitmap||!window.DataTransfer)return;
 try{
  const bmp=await createImageBitmap(file);const max=1920,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
  if(scale===1&&file.size<2*1024*1024){bmp.close();return;}
  const canvas=document.createElement('canvas');canvas.width=Math.round(bmp.width*scale);canvas.height=Math.round(bmp.height*scale);
  const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob||blob.size>=file.size)return;
  const optimized=new File([blob],(file.name.replace(/\\.[^.]+$/,'')||'community-photo')+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
  const transfer=new DataTransfer();transfer.items.add(optimized);input.files=transfer.files;
  status('An rage girman hoto domin saurin lodawa.');
 }catch(e){console.warn('Image optimization skipped:',e);}
}
function setupMediaOptimization(){
 const input=$('communityPostMedia');
 if(input&&!input.dataset.uyOptimized){input.dataset.uyOptimized='1';input.addEventListener('change',()=>optimizeSelectedImage(input));}
 const feed=$('communityFeed');if(feed){
  const optimize=()=>{feed.querySelectorAll('img').forEach(img=>{img.loading='lazy';img.decoding='async';});feed.querySelectorAll('video').forEach(v=>{v.preload='metadata';v.playsInline=true;});};
  optimize();if(window.MutationObserver)new MutationObserver(optimize).observe(feed,{childList:true,subtree:true});
 }
}
function init(){
 panel();setupMediaOptimization();
 document.querySelectorAll('#socialPlatformHub .social-hub-tabs button').forEach(b=>{
  if(b.dataset.advancedBound)return;b.dataset.advancedBound='1';
  if(!b.dataset.tab)b.addEventListener('click',()=>{if(b.textContent.includes('Reels'))enhanceReels();});
 });
 const feed=$('communityFeed');if(feed&&window.MutationObserver)new MutationObserver(addFeedActions).observe(feed,{childList:true,subtree:true});
 addFeedActions();enhanceReels();
}
function enhanceReels(){
 const box=$('socialReelsList');if(!box||box.dataset.uyScrollEnhanced)return;
 box.dataset.uyScrollEnhanced='1';box.style.cssText='display:flex;flex-direction:column;gap:14px;max-height:72vh;overflow-y:auto;scroll-snap-type:y mandatory';
 const mo=new MutationObserver(()=>box.querySelectorAll('video').forEach(v=>{v.playsInline=true;v.preload='metadata';v.style.cssText='width:100%;max-height:70vh;object-fit:contain;background:#000;border-radius:14px;scroll-snap-align:start';}));
 mo.observe(box,{childList:true,subtree:true});mo.takeRecords();box.querySelectorAll('video').forEach(v=>{v.playsInline=true;v.preload='metadata';v.style.cssText='width:100%;max-height:70vh;object-fit:contain;background:#000;border-radius:14px;scroll-snap-align:start';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,300));else setTimeout(init,300);
window.uyCommunityReport=report;window.uyCommunitySave=saveItem;window.uyCommunityRefresh=init;
})();