import React,{useState} from 'react';
import{createRoot}from'react-dom/client';
import{Home,ClipboardList,Plus,User,Settings,LifeBuoy,Wallet,MapPin,ChevronRight,Bell,Search,Star,Clock,CheckCircle2,ArrowLeft,Menu,X,ShoppingBag,Package,Car,House,FileText,Laptop,Send,Navigation,ShieldCheck}from'lucide-react';
import'./styles.css';

const tasks=[
 {title:'Pick up documents',type:'Documents',location:'Wuse, Abuja',price:'₦8,000',time:'Today',distance:'4.2 km',color:'blue',emoji:'📄'},
 {title:'Weekly grocery shopping',type:'Shopping',location:'Maitama, Abuja',price:'₦12,500',time:'Today',distance:'6.8 km',color:'yellow',emoji:'🛒'},
 {title:'Deliver a small package',type:'Delivery',location:'Garki, Abuja',price:'₦7,500',time:'Tomorrow',distance:'8.1 km',color:'pink',emoji:'📦'},
 {title:'Help move a few boxes',type:'Moving',location:'Gwarinpa, Abuja',price:'₦18,000',time:'Sat, 10 AM',distance:'11 km',color:'green',emoji:'📦'},
];
const categories=[['Shopping','🛒'],['Delivery','📦'],['Home','🏠'],['Transport','🚗'],['Documents','📄'],['Online','💻'],['Business','💼'],['Other','✨']];

function App(){
 const[screen,setScreen]=useState('home');
 const[menu,setMenu]=useState(false);
 const[selected,setSelected]=useState(null);
 const[modal,setModal]=useState(false);
 const[posted,setPosted]=useState([]);
 const[search,setSearch]=useState('');
 const[toast,setToast]=useState('');
 const filtered=tasks.filter(t=>(t.title+t.type+t.location).toLowerCase().includes(search.toLowerCase()));
 const go=s=>{setScreen(s);setMenu(false);window.scrollTo(0,0)};
 const notify=m=>{setToast(m);setTimeout(()=>setToast(''),2200)};
 return <div className="stage">
  <div className="appShell">
   <header className="topbar">
    <button className="circleBtn" onClick={()=>setMenu(!menu)}>{menu?<X size={20}/>:<Menu size={20}/>}</button>
    <button className="brand" onClick={()=>go('home')}><span className="brandMark">E</span><span>ErrandGo</span></button>
    <button className="circleBtn" onClick={()=>notify('You have no new notifications')}><Bell size={19}/><i/></button>
   </header>

   {menu&&<div className="drawer"><div className="drawerProfile"><div className="avatar big">S</div><div><b>Success Uchendu</b><small>success@example.com</small></div></div><button onClick={()=>go('home')}><Home/>Home</button><button onClick={()=>go('tasks')}><ClipboardList/>My Errands</button><button onClick={()=>go('wallet')}><Wallet/>Wallet</button><button onClick={()=>go('profile')}><User/>Profile</button><button onClick={()=>notify('Support chat opened')}><LifeBuoy/>Support</button><button onClick={()=>notify('Settings opened')}><Settings/>Settings</button></div>}

   {screen==='home'&&<HomeScreen go={go} setModal={setModal} tasks={filtered} posted={posted} notify={notify}/>} 
   {screen==='tasks'&&<TasksScreen tasks={filtered} search={search} setSearch={setSearch} open={t=>{setSelected(t);setScreen('detail')}}/>}
   {screen==='wallet'&&<WalletScreen notify={notify}/>} 
   {screen==='profile'&&<ProfileScreen notify={notify}/>} 
   {screen==='detail'&&selected&&<Detail task={selected} back={()=>setScreen('tasks')} notify={notify}/>} 

   {screen!=='detail'&&<BottomNav screen={screen} go={go} setModal={setModal}/>} 
  </div>
  {modal&&<PostModal close={()=>setModal(false)} save={t=>{setPosted(p=>[t,...p]);setModal(false);notify('Errand posted successfully')}}/>}
  {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
 </div>
}

function HomeScreen({go,setModal,tasks,posted,notify}){return <main className="content homeScreen">
 <section className="welcome"><div><small>Wednesday, August 26</small><h1>Hi Success <span>👋</span></h1><p>What can we help you get done today?</p></div><div className="miniAvatar">S</div></section>
 <section className="heroCard"><div className="heroGlow"/><div className="heroCopy"><span className="pill">GET THINGS DONE</span><h2>Someone can help.<br/><strong>You just need to ask.</strong></h2><p>Post any errand and connect with a trusted person ready to get it done.</p><div className="heroActions"><button className="limeBtn" onClick={()=>setModal(true)}><Plus size={18}/> Post Errand</button><button className="whiteBtn" onClick={()=>go('tasks')}>Find Errands <ChevronRight size={17}/></button></div></div><div className="heroIllustration"><div className="blob b1"/><div className="blob b2"/><div className="person">🛵</div><div className="floating f1">✓ Accepted</div><div className="floating f2">₦8,000</div></div></section>
 <section className="quickGrid"><button onClick={()=>setModal(true)}><span className="qIcon purple"><Plus/></span><b>Post an Errand</b><small>Need a helping hand?</small></button><button onClick={()=>go('tasks')}><span className="qIcon green"><ClipboardList/></span><b>Find Errands</b><small>Earn by helping others</small></button><button onClick={()=>go('wallet')}><span className="qIcon orange"><Wallet/></span><b>My Wallet</b><small>Manage your earnings</small></button></section>
 <section><div className="sectionTitle"><h3>Popular errands</h3><button onClick={()=>go('tasks')}>See all <ChevronRight size={15}/></button></div><div className="categoryRow">{categories.map(([n,e])=><button key={n} onClick={()=>go('tasks')}><span>{e}</span><small>{n}</small></button>)}</div></section>
 <section><div className="sectionTitle"><h3>Errands around you</h3><button onClick={()=>go('tasks')}>View all <ChevronRight size={15}/></button></div><div className="taskList">{tasks.slice(0,3).map(t=><TaskCard key={t.title} task={t} open={()=>{}} notify={notify}/>)}</div>{posted.length>0&&<div className="postedNotice"><CheckCircle2/><div><b>Your errand is live</b><small>{posted[0].title}</small></div><span>Posted</span></div>}</section>
 </main>}

function TaskCard({task,open,notify}){return <article className="taskCard" onClick={open}><div className="taskIcon">{task.emoji}</div><div className="taskMain"><div className="taskLine"><span>{task.type}</span><span className="taskTime"><Clock size={12}/>{task.time}</span></div><h4>{task.title}</h4><p><MapPin size={12}/>{task.location} · {task.distance}</p><div className="taskBottom"><strong>{task.price}</strong><span><Star size={12} fill="currentColor"/> 4.9</span><button onClick={e=>{e.stopPropagation();notify('Task saved')}}>♡</button></div></div></article>}

function TasksScreen({tasks,search,setSearch,open}){return <main className="content"><div className="pageTitle"><div><small>EXPLORE</small><h2>Find errands to do</h2></div><button className="circleBtn"><MapPin size={18}/></button></div><div className="searchBar"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search errands, places or services"/></div><div className="filterRow"><button className="active">Nearby</button><button>Online</button><button>Global</button><button>Best match</button></div><div className="earnBanner"><div><span>READY TO EARN?</span><b>Turn spare time into money.</b><small>Choose an errand that works for you.</small></div><div className="earnCoin">₦</div></div><div className="sectionTitle"><h3>{tasks.length} errands available</h3><button>Filter</button></div><div className="taskList">{tasks.map(t=><TaskCard key={t.title} task={t} open={()=>open(t)}/>)}</div></main>}

function Detail({task,back,notify}){return <main className="content detail"><button className="back" onClick={back}><ArrowLeft size={19}/> Back</button><div className="detailArt"><span>{task.emoji}</span><div className="mapDot"><Navigation/></div></div><span className="tag">{task.type}</span><h2>{task.title}</h2><div className="detailMeta"><span><MapPin/> {task.location}</span><span><Clock/> {task.time}</span></div><div className="detailPrice"><small>Budget</small><strong>{task.price}</strong><span>Secure payment protected</span></div><section className="infoCard"><h3>What needs to be done?</h3><p>Please pick up the item, confirm the collection, and deliver it to the provided destination. The requester will provide exact instructions after you accept.</p><div className="trust"><ShieldCheck/><div><b>Verified requester</b><small>4.9 ★ · 38 completed errands</small></div></div></section><button className="limeBtn fullBtn" onClick={()=>notify('Application sent successfully')}>Accept Errand <ChevronRight/></button></main>}

function WalletScreen({notify}){return <main className="content"><div className="pageTitle"><div><small>MY WALLET</small><h2>Your earnings</h2></div><button className="circleBtn"><Wallet size={18}/></button></div><section className="walletCard"><span>Available balance</span><h2>₦125,500<span>.00</span></h2><div><small>+₦28,400 this month</small><button onClick={()=>notify('Withdrawal flow opened')}>Withdraw</button></div></section><div className="walletActions"><button onClick={()=>notify('Add money flow opened')}><Plus/>Add money</button><button onClick={()=>notify('Transaction history opened')}><ClipboardList/>History</button></div><div className="sectionTitle"><h3>Recent activity</h3><button>See all</button></div><div className="transactions">{[['Errand completed','+₦8,000','Today'],['Withdrawal','-₦20,000','Yesterday'],['Errand completed','+₦12,500','Aug 23']].map(x=><div><span className="transactionIcon">₦</span><div><b>{x[0]}</b><small>{x[2]}</small></div><strong className={x[1][0]==='+'?'positive':''}>{x[1]}</strong></div>)}</div></main>}

function ProfileScreen({notify}){return <main className="content profile"><div className="profileHead"><div className="avatar profileAvatar">S</div><h2>Success Uchendu</h2><p>@success · Abuja, Nigeria</p><div className="verified"><ShieldCheck size={14}/> Identity verified</div></div><div className="stats"><div><b>48</b><small>Completed</small></div><div><b>4.9</b><small>Rating</small></div><div><b>₦184k</b><small>Earned</small></div></div><div className="profileMenu">{[['Profile details',User],['Payment methods',Wallet],['Saved errands',ClipboardList],['Settings',Settings],['Help & Support',LifeBuoy]].map(([n,I])=><button onClick={()=>notify(n+' opened')}><span><I/></span><b>{n}</b><ChevronRight/></button>)}</div></main>}

function BottomNav({screen,go,setModal}){return <nav className="bottomNav"><button className={screen==='home'?'active':''} onClick={()=>go('home')}><Home/><span>Home</span></button><button className={screen==='tasks'?'active':''} onClick={()=>go('tasks')}><ClipboardList/><span>Errands</span></button><button className="postFab" onClick={()=>setModal(true)}><Plus/><span>Post</span></button><button className={screen==='wallet'?'active':''} onClick={()=>go('wallet')}><Wallet/><span>Wallet</span></button><button className={screen==='profile'?'active':''} onClick={()=>go('profile')}><User/><span>Profile</span></button></nav>}

function PostModal({close,save}){const[title,setTitle]=useState('');const[description,setDescription]=useState('');const[price,setPrice]=useState('');return <div className="overlay"><div className="postModal"><button className="modalClose" onClick={close}><X/></button><span className="pill purplePill">POST AN ERRAND</span><h2>What needs to be done?</h2><p>Give a clear description so the right person can help.</p><label>Errand title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Pick up my package"/></label><label>Details<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the task..."/></label><div className="two"><label>Budget<input value={price} onChange={e=>setPrice(e.target.value)} placeholder="₦ 0.00"/></label><label>When<select><option>Today</option><option>Tomorrow</option><option>This week</option></select></label></div><button className="limeBtn fullBtn" disabled={!title} onClick={()=>save({title:title||'New errand',type:'Custom',location:'Your location',price:price?'₦'+price:'Budget pending',time:'Today',distance:'Nearby',emoji:'✨'})}>Post Errand <Send size={17}/></button></div></div>}

createRoot(document.getElementById('root')).render(<App/>);