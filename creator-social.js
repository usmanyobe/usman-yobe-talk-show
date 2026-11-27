/* USMAN YOBE CREATOR SOCIAL — Reels engagement + approved creator directory */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db=()=>window.db;
const user=()=>window.communityUser;
const note=(s,bad)=>{const e=document.getElementById('socialHubStatus');if(e){e.textContent=s;e.style.color=bad?'#b42318':'#087443';}};
const validId=id=>/^[0-9a-f-]{30,40}$/i.test(String(id));
async function loadReels(preservePosition=false){
 const box=document.getElementById('socialReelsList');if(!box)return;
 const savedY=preservePosition?(window.scrollY||document.documentElement.scrollTop||document.body.scrollTop||0):null;
 if(!box.children.length)box.textContent='Ana loda Reels...';
 const {data:reels,error}=await db().from('social_reels').select('id,user_id,title,video_url,caption,created_at').order('created_at',{ascending:false}).limit(30);
 if(error){box.textContent='Ba a iya loda Reels ba: '+error.message;return;}
 const rows=reels||[];if(!rows.length){box.innerHTML='<p class="community-muted">Babu Reel tukuna. Ka zama na farko da zai wallafa.</p>';return;}
 const ids=rows.map(x=>x.id),users=[...new Set(rows.map(x=>x.user_id).filter(Boolean))];
 const [likesResult,commentsResult,profilesResult]=await Promise.all([
  db().from('social_reel_likes').select('reel_id,user_id').in('reel_id',ids),
  db().from('social_reel_comments').select('id,reel_id,user_id,content,created_at').in('reel_id',ids).order('created_at',{ascending:true}).limit(300),
  users.length?db().from('community_profiles').select('id,full_name,avatar_url').in('id',users):Promise.resolve({data:[],error:null})
 ]);
 const likes=likesResult.error?[]:(likesResult.data||[]),comments=commentsResult.error?[]:(commentsResult.data||[]);
 const profiles=new Map((profilesResult.data||[]).map(p=>[String(p.id),p]));
 box.innerHTML=rows.map(r=>{
  const mine=likes.some(x=>String(x.reel_id)===String(r.id)&&String(x.user_id)===String(user()?.id));
  const rl=likes.filter(x=>String(x.reel_id)===String(r.id));
  const rc=comments.filter(x=>String(x.reel_id)===String(r.id));
  const author=profiles.get(String(r.user_id));
  const authorName=author?.full_name||'USMAN YOBE Member';
  const commentHtml=rc.map(c=>'<div class="uy-reel-comment"><b>'+esc(profiles.get(String(c.user_id))?.full_name||'Member')+'</b><p>'+esc(c.content)+'</p><small>'+esc(new Date(c.created_at).toLocaleString())+'</small></div>').join('');
  return '<article class="social-hub-card uy-reel-card" data-reel="'+esc(r.id)+'"><div class="uy-reel-author"><b>'+esc(authorName)+'</b><small>'+esc(new Date(r.created_at).toLocaleString())+'</small><button type="button" class="community-btn secondary" data-open-creator="'+esc(r.user_id)+'">View profile</button></div><h4>'+esc(r.title)+'</h4><p>'+esc(r.caption||'')+'</p><video controls playsinline preload="metadata" src="'+esc(r.video_url)+'"></video><div class="uy-reel-actions"><button type="button" class="community-btn secondary" data-reel-like="'+esc(r.id)+'">'+(mine?'❤️ Liked':'🤍 Like')+' ('+rl.length+')</button><span data-reel-comment-count="'+esc(r.id)+'">'+rc.length+' comments</span><button type="button" class="community-btn secondary" data-reel-save="'+esc(r.id)+'">🔖 Save</button></div><div class="uy-reel-comments">'+(commentHtml||'<p class="community-muted">Babu comments tukuna.</p>')+'</div>'+(user()?'<div class="uy-reel-comment-form"><input maxlength="800" id="uyReelComment_'+esc(r.id)+'" class="community-input" placeholder="Rubuta comment..."><button type="button" class="community-btn" data-reel-comment="'+esc(r.id)+'">Aika</button></div>':'<p class="community-muted">Shiga account domin yin comment.</p>')+'</article>';
 }).join('');
 if(savedY!==null){requestAnimationFrame(()=>{window.scrollTo({top:savedY,behavior:'instant'});requestAnimationFrame(()=>window.scrollTo({top:savedY,behavior:'instant'}));});}
 box.querySelectorAll('[data-reel-like]').forEach(b=>b.addEventListener('click',()=>toggleLike(b.dataset.reelLike)));
 box.querySelectorAll('[data-reel-comment]').forEach(b=>b.addEventListener('click',()=>addComment(b.dataset.reelComment)));
 box.querySelectorAll('[data-open-creator]').forEach(b=>b.addEventListener('click',()=>{if(typeof window.showMemberProfile==='function')window.showMemberProfile(b.dataset.openCreator);}));
 box.querySelectorAll('[data-reel-save]').forEach(b=>b.addEventListener('click',()=>{if(window.uyCommunitySave)window.uyCommunitySave('reel',b.dataset.reel);}));
}
async function toggleLike(id){
 if(!user()){note('Shiga account domin yin Like.',true);return;}
 if(!validId(id))return;
 const {data:existing,error:readError}=await db().from('social_reel_likes').select('reel_id').eq('reel_id',id).eq('user_id',user().id).maybeSingle();
 if(readError){note('Ba a iya duba Like ba: '+readError.message,true);return;}
 const result=existing?await db().from('social_reel_likes').delete().eq('reel_id',id).eq('user_id',user().id):await db().from('social_reel_likes').insert({reel_id:id,user_id:user().id});
 if(result.error){note('Ba a sabunta Like ba: '+result.error.message,true);return;}
 const button=document.querySelector('[data-reel-like="'+CSS.escape(id)+'"]');
 if(button){const match=button.textContent.match(/\((\d+)\)/);let count=match?Number(match[1]):0;const nowLiked=!existing;count=Math.max(0,count+(nowLiked?1:-1));button.textContent=(nowLiked?'❤️ Liked':'🤍 Like')+' ('+count+')';}
}
async function addComment(id){
 if(!user()){note('Shiga account domin yin comment.',true);return;}
 if(!validId(id))return;
 const input=document.getElementById('uyReelComment_'+id),content=input?.value.trim()||'';
 if(content.length<1){note('Rubuta comment kafin aikawa.',true);return;}
 const {error}=await db().from('social_reel_comments').insert({reel_id:id,user_id:user().id,content});
 if(error){note('Ba a aika comment ba: '+error.message,true);return;}
 const list=document.querySelector('[data-reel="'+CSS.escape(id)+'"] .uy-reel-comments');
 if(list){const empty=list.querySelector('.community-muted');if(empty)empty.remove();const item=document.createElement('div');item.className='uy-reel-comment';const who=document.createElement('b');who.textContent='Kai';const body=document.createElement('p');body.textContent=content;const when=document.createElement('small');when.textContent=new Date().toLocaleString();item.append(who,body,when);list.appendChild(item);}
 const count=document.querySelector('[data-reel-comment-count="'+CSS.escape(id)+'"]');
 if(count){const n=Number((count.textContent.match(/\d+/)||['0'])[0])+1;count.textContent=n+' comments';}
 input.value='';note('An aika comment.');
}
async function loadCreatorDirectory(){
 const panel=document.getElementById('socialCreatorPanel');if(!panel)return;
 let section=document.getElementById('uyCreatorDirectory');
 if(!section){section=document.createElement('div');section.id='uyCreatorDirectory';section.className='social-hub-card';section.style.margin='12px 0';const stats=document.getElementById('socialCreatorStats');if(stats)stats.insertAdjacentElement('afterend',section);}
 section.innerHTML='<h4>🌟 Approved Creators</h4><p class="community-muted">Ana loda shafukan creators...</p>';
 const {data:creators,error}=await db().from('creator_applications').select('user_id,display_name,bio,social_link,created_at').eq('status','approved').order('reviewed_at',{ascending:false}).limit(60);
 if(error){section.innerHTML='<h4>🌟 Approved Creators</h4><p class="community-muted">Ba a iya loda creators: '+esc(error.message)+'</p>';return;}
 const rows=creators||[];if(!rows.length){section.innerHTML='<h4>🌟 Approved Creators</h4><p class="community-muted">Babu approved creator a yanzu. Da zarar admin ya amince da mutum, shafinsa zai bayyana a nan.</p>';return;}
 const ids=rows.map(x=>x.user_id);
 const [profilesResult,followsResult,myFollowsResult]=await Promise.all([
  db().from('community_profiles').select('id,full_name,avatar_url,is_verified').in('id',ids),
  db().from('member_follows').select('following_id').in('following_id',ids),
  user()?db().from('member_follows').select('following_id').eq('follower_id',user().id).in('following_id',ids):Promise.resolve({data:[],error:null})
 ]);
 const profiles=new Map((profilesResult.data||[]).map(p=>[String(p.id),p]));
 const counts=new Map();(followsResult.data||[]).forEach(x=>counts.set(String(x.following_id),(counts.get(String(x.following_id))||0)+1));
 const mine=new Set((myFollowsResult.data||[]).map(x=>String(x.following_id)));
 section.innerHTML='<h4>🌟 Approved Creators</h4><div class="uy-creator-grid">'+rows.map(c=>{
  const p=profiles.get(String(c.user_id)),name=c.display_name||p?.full_name||'Creator';
  const avatar=p?.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="">':'<span>👤</span>';
  return '<article class="uy-creator-card">'+avatar+'<b>'+esc(name)+'</b><small>'+(p?.is_verified?'✔ Verified member':'Approved creator')+'</small><p>'+esc(c.bio||'')+'</p><small>👥 '+(counts.get(String(c.user_id))||0)+' followers</small><div><button type="button" class="community-btn secondary" data-creator-profile="'+esc(c.user_id)+'">View profile</button>'+(user()&&String(user().id)!==String(c.user_id)?'<button type="button" class="community-btn" data-creator-follow="'+esc(c.user_id)+'">'+(mine.has(String(c.user_id))?'Following':'＋ Follow')+'</button>':'')+'</div></article>';
 }).join('')+'</div>';
 section.querySelectorAll('[data-creator-profile]').forEach(b=>b.addEventListener('click',()=>{if(typeof window.showMemberProfile==='function')window.showMemberProfile(b.dataset.creatorProfile);}));
 section.querySelectorAll('[data-creator-follow]').forEach(b=>b.addEventListener('click',async()=>{if(!user()){note('Shiga account domin Follow.',true);return;}const id=b.dataset.creatorFollow;const exists=mine.has(String(id));const q=exists?db().from('member_follows').delete().eq('follower_id',user().id).eq('following_id',id):db().from('member_follows').insert({follower_id:user().id,following_id:id});const {error}=await q;if(error){note('Ba a sabunta Follow ba: '+error.message,true);return;}await loadCreatorDirectory();}));
}
function addStyles(){
 if(document.getElementById('uyCreatorSocialStyles'))return;
 const style=document.createElement('style');style.id='uyCreatorSocialStyles';style.textContent='.uy-reel-card video{display:block;width:100%;height:min(65vh,560px);aspect-ratio:9/16;object-fit:contain;background:#000;border-radius:12px;margin:10px 0;flex:none}.uy-reel-author{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.uy-reel-author small{color:#778399;flex:1}.uy-reel-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:10px 0}.uy-reel-actions span{font-size:12px;color:#6b778c}.uy-reel-comments{display:grid;gap:7px;margin-top:10px}.uy-reel-comment{background:#f4f7fb;border-radius:9px;padding:9px}.uy-reel-comment p{margin:5px 0;font-size:13px;white-space:pre-wrap}.uy-reel-comment small{color:#778399;font-size:10px}.uy-reel-comment-form{display:flex;gap:8px;margin-top:10px}.uy-reel-comment-form input{flex:1;min-width:0}.uy-creator-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.uy-creator-card{background:#f7f9fd;border:1px solid #e5ebf4;border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:flex-start;gap:6px}.uy-creator-card>img,.uy-creator-card>span{width:54px;height:54px;border-radius:50%;object-fit:cover;background:#e6edf8;display:grid;place-items:center;font-size:26px}.uy-creator-card>small{color:#68768b;font-size:11px}.uy-creator-card p{font-size:12px;line-height:1.5;margin:0}.uy-creator-card>div{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.uy-creator-card button{font-size:11px;padding:8px}.uy-reel-comment-form button{white-space:nowrap}';
 style.textContent+=' html{scroll-behavior:auto!important} #socialReelsList{overflow-anchor:none} .uy-reel-card{overflow-anchor:none}';
 document.head.appendChild(style);
}
function init(){
 addStyles();
 const originalReels=window.socialLoadReels;
 if(typeof originalReels==='function'&&!originalReels.__uyEnhanced){const enhanced=async function(){await loadReels();};enhanced.__uyEnhanced=true;window.socialLoadReels=enhanced;}
 const originalCreator=window.socialLoadCreator;
 if(typeof originalCreator==='function'&&!originalCreator.__uyEnhanced){const enhanced=async function(){await originalCreator.apply(this,arguments);await loadCreatorDirectory();};enhanced.__uyEnhanced=true;window.socialLoadCreator=enhanced;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else init();
window.uyLoadCreatorDirectory=loadCreatorDirectory;
})();