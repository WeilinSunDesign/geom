import { useState, useRef, useCallback, useEffect } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_ROOM_W = 240, MIN_ROOM_H = 160, MAX_ROOM_W = 640, MAX_ROOM_H = 480
const MIN_W = 18, MIN_H = 18
const CORNER_HIT = 14          // px — corner drag zone radius
const GRID = 16                // floor grid cell size (px)
const PX_PER_CM = 1            // 1 px == 1 cm for display

const FURNITURE = [
  { type:'bed',      emoji:'🛏', label:'床',   w:88, h:64,  color:'#1A1A1A', isWall:false },
  { type:'desk',     emoji:'🖥', label:'书桌', w:76, h:52,  color:'#3A3A3A', isWall:false },
  { type:'wardrobe', emoji:'🗄', label:'衣柜', w:52, h:84,  color:'#222',   isWall:false },
  { type:'sofa',     emoji:'🛋', label:'沙发', w:92, h:52,  color:'#555',   isWall:false },
  { type:'plant',    emoji:'🌿', label:'绿植', w:36, h:36,  color:'#6A6A6A', isWall:false },
  { type:'lamp',     emoji:'💡', label:'灯',   w:28, h:28,  color:'#888',   isWall:false },
  { type:'mirror',   emoji:'🪞', label:'镜子', w:28, h:62,  color:'#AAAAAA', isWall:false },
  { type:'crystal',  emoji:'🔮', label:'水晶', w:26, h:26,  color:'#CCCCCC', isWall:false },
  { type:'door',     emoji:'🚪', label:'门',   w:48, h:10,  color:'#333',   isWall:true  },
  { type:'window',   emoji:'🪟', label:'窗',   w:58, h:10,  color:'#BBBBBB', isWall:true  },
]

const ZONE_LABELS = {
  NW:'乾·贵人', N:'坎·事业', NE:'艮·学识',
  W:'兑·创意',  C:'中·健康', E:'震·家庭',
  SW:'坤·爱情', S:'离·名声', SE:'巽·财富',
}
const ZONE_POS = {
  NW:[0,0],N:[1,0],NE:[2,0],
  W:[0,1], C:[1,1],E:[2,1],
  SW:[0,2],S:[1,2],SE:[2,2],
}
const getZone = (xP,yP) =>
  [['NW','N','NE'],['W','C','E'],['SW','S','SE']][yP<33?0:yP<67?1:2][xP<33?0:xP<67?1:2]

const snapToWall = (item, x, y, rW, rH) => {
  const cx = x+item.w/2, cy = y+item.h/2
  return [
    { d:cy,    snap:{ x:Math.max(0,Math.min(rW-item.w,x)), y:0 } },
    { d:rH-cy, snap:{ x:Math.max(0,Math.min(rW-item.w,x)), y:rH-item.h } },
    { d:cx,    snap:{ x:0,       y:Math.max(0,Math.min(rH-item.h,y)) } },
    { d:rW-cx, snap:{ x:rW-item.w, y:Math.max(0,Math.min(rH-item.h,y)) } },
  ].sort((a,b)=>a.d-b.d)[0].snap
}

const isDark = hex => {
  const v = parseInt(hex.replace('#',''), 16)
  const r=(v>>16)&255, g=(v>>8)&255, b=v&255
  return (r*299+g*587+b*114)/1000 < 128
}

const toCm  = px => Math.round(px * PX_PER_CM)
const toIn  = px => (px * PX_PER_CM / 2.54).toFixed(1)
const fmtUnit = (px, unit) => unit==='cm' ? `${toCm(px)} cm` : `${toIn(px)}"`

const QUICK = ['帮我全面分析我的房间','最近烂桃花 😭','工作总不顺','睡眠很差','财运不好']

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,        setTab]        = useState('room')
  const [roomW,      setRoomW]      = useState(460)
  const [roomH,      setRoomH]      = useState(340)
  const [northAngle, setNorthAngle] = useState(0)
  const [showBagua,  setShowBagua]  = useState(false)
  const [unit,       setUnit]       = useState('cm')
  const [selectedId, setSelectedId] = useState(null)
  const [colorPickId,setColorPickId]= useState(null)

  const [items, setItems] = useState([
    { id:'1', type:'bed',      emoji:'🛏', label:'床',   x:28, y:52,  w:88, h:64, color:'#1A1A1A', isWall:false },
    { id:'2', type:'desk',     emoji:'🖥', label:'书桌', x:270,y:28,  w:76, h:52, color:'#3A3A3A', isWall:false },
    { id:'3', type:'plant',    emoji:'🌿', label:'绿植', x:370,y:244, w:36, h:36, color:'#6A6A6A', isWall:false },
    { id:'4', type:'wardrobe', emoji:'🗄', label:'衣柜', x:28, y:228, w:52, h:84, color:'#222',   isWall:false },
    { id:'5', type:'door',     emoji:'🚪', label:'门',   x:162,y:0,   w:48, h:10, color:'#333',   isWall:true  },
    { id:'6', type:'window',   emoji:'🪟', label:'窗',   x:290,y:330, w:58, h:10, color:'#BBBBBB',isWall:true  },
  ])

  const drag         = useRef(null)
  const roomRef      = useRef(null)
  const colorInputRef= useRef(null)
  const chatEndRef   = useRef(null)
  const fileInputRef = useRef(null)

  const [birthYear,    setBirthYear]    = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [inputValue,   setInputValue]   = useState('')
  const [loading,      setLoading]      = useState(false)
  const [messages,     setMessages]     = useState([
    { role:'assistant', content:'✨ 你好！我是你的赛博风水师。\n\n布置好你的房间后，告诉我你的困惑吧 🌙\n\n💡 双击家具可以换颜色' },
  ])
  const [apiHistory,   setApiHistory]   = useState([])

  const [uploadedPhoto,    setUploadedPhoto]    = useState(null)
  const [openaiKey,        setOpenaiKey]        = useState('')
  const [showOAIKey,       setShowOAIKey]       = useState(false)
  const [generatingImage,  setGeneratingImage]  = useState(false)
  const [hasAnalyzed,      setHasAnalyzed]      = useState(false)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) },
    [messages, loading, generatingImage])

  // ── Drag ─────────────────────────────────────────────────────────────────

  const getCorner = (e, el) => {
    const r = el.getBoundingClientRect()
    const lx = e.clientX-r.left, ly = e.clientY-r.top
    const w = r.width, h = r.height, z = CORNER_HIT
    if (lx<z && ly<z)         return 'nw'
    if (lx>w-z && ly<z)       return 'ne'
    if (lx<z && ly>h-z)       return 'sw'
    if (lx>w-z && ly>h-z)     return 'se'
    return 'move'
  }

  const itemMouseDown = (e, id) => {
    if (e.detail === 2) return          // let dblclick handle
    e.preventDefault(); e.stopPropagation()
    setSelectedId(id)
    const corner = getCorner(e, e.currentTarget)
    const it = items.find(i=>i.id===id)
    drag.current = {
      mode: corner==='move' ? 'move' : `resize-${corner}`,
      id,
      sx:e.clientX, sy:e.clientY,
      orig:{ x:it.x, y:it.y, w:it.w, h:it.h, roomW, roomH },
    }
  }

  const roomEdgeDown = (e, mode) => {
    e.preventDefault()
    drag.current = { mode, id:null, sx:e.clientX, sy:e.clientY, orig:{ roomW, roomH } }
  }

  const onMouseMove = useCallback((e) => {
    const d = drag.current; if (!d) return
    const dx=e.clientX-d.sx, dy=e.clientY-d.sy

    if (d.mode==='compass') {
      const r = roomRef.current?.getBoundingClientRect(); if (!r) return
      const a = Math.atan2(e.clientX-(r.right-34), -(e.clientY-(r.top+34)))*180/Math.PI
      setNorthAngle((a+360)%360); return
    }

    if      (d.mode==='room-e')  setRoomW(()=>clamp(d.orig.roomW+dx,  MIN_ROOM_W, MAX_ROOM_W))
    else if (d.mode==='room-s')  setRoomH(()=>clamp(d.orig.roomH+dy,  MIN_ROOM_H, MAX_ROOM_H))
    else if (d.mode==='room-se') {
      setRoomW(()=>clamp(d.orig.roomW+dx, MIN_ROOM_W, MAX_ROOM_W))
      setRoomH(()=>clamp(d.orig.roomH+dy, MIN_ROOM_H, MAX_ROOM_H))
    }
    else if (d.mode==='move') {
      setItems(prev=>prev.map(it=>{
        if (it.id!==d.id) return it
        let nx=clamp(d.orig.x+dx, 0, d.orig.roomW-it.w)
        let ny=clamp(d.orig.y+dy, 0, d.orig.roomH-it.h)
        if (it.isWall) ({ x:nx,y:ny }=snapToWall(it,nx,ny,d.orig.roomW,d.orig.roomH))
        return {...it, x:nx, y:ny}
      }))
    }
    else if (d.mode.startsWith('resize-')) {
      const corner = d.mode.slice(7)
      setItems(prev=>prev.map(it=>{
        if (it.id!==d.id) return it
        let { x,y,w,h } = d.orig
        if (corner==='se') { w=Math.max(MIN_W,w+dx); h=Math.max(MIN_H,h+dy) }
        if (corner==='sw') { const nw=Math.max(MIN_W,w-dx); x=x+w-nw; w=nw; h=Math.max(MIN_H,h+dy) }
        if (corner==='ne') { w=Math.max(MIN_W,w+dx); const nh=Math.max(MIN_H,h-dy); y=y+h-nh; h=nh }
        if (corner==='nw') { const nw=Math.max(MIN_W,w-dx); x=x+w-nw; w=nw; const nh=Math.max(MIN_H,h-dy); y=y+h-nh; h=nh }
        x=clamp(x,0,d.orig.roomW-MIN_W); y=clamp(y,0,d.orig.roomH-MIN_H)
        w=Math.min(w,d.orig.roomW-x);    h=Math.min(h,d.orig.roomH-y)
        return {...it,x,y,w,h}
      }))
    }
  }, [])

  const onMouseUp = useCallback(()=>{ drag.current=null },[])

  useEffect(()=>{
    window.addEventListener('mousemove',onMouseMove)
    window.addEventListener('mouseup',onMouseUp)
    return ()=>{ window.removeEventListener('mousemove',onMouseMove); window.removeEventListener('mouseup',onMouseUp) }
  },[onMouseMove,onMouseUp])

  useEffect(()=>{
    setItems(p=>p.map(it=>({ ...it,
      x:clamp(it.x,0,roomW-it.w),
      y:clamp(it.y,0,roomH-it.h),
    })))
  },[roomW,roomH])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clamp = (v,lo,hi)=>Math.min(hi,Math.max(lo,v))

  const addItem = type => {
    const t = FURNITURE.find(f=>f.type===type)
    const sx = t.isWall ? roomW/2-t.w/2 : 80+Math.random()*100
    const sy = t.isWall ? 0 : 60+Math.random()*80
    const pos = t.isWall ? snapToWall(t,sx,sy,roomW,roomH) : {x:sx,y:sy}
    setItems(p=>[...p,{id:Date.now().toString(),...t,...pos}])
  }

  const compassDirAt = off => {
    const a = ((northAngle+off)+360)%360
    return ['北','东北','东','东南','南','西南','西','西北'][Math.round(a/45)%8]
  }

  const describeRoom = () =>
    `房间朝向：顶部为${compassDirAt(0)}，约${toCm(roomW)}×${toCm(roomH)}cm，家具：` +
    items.map(it=>{
      const xP=((it.x+it.w/2)/roomW)*100, yP=((it.y+it.h/2)/roomH)*100
      return `${it.label}在${ZONE_LABELS[getZone(xP,yP)]}区`
    }).join('、')

  // ── API ──────────────────────────────────────────────────────────────────

  const apiHdr = ()=>({
    'Content-Type':'application/json',
    'x-api-key':anthropicKey.trim(),
    'anthropic-version':'2023-06-01',
    'anthropic-dangerous-direct-browser-access':'true',
  })

  const sendMessage = async txt => {
    const msg=(txt||inputValue).trim(); if(!msg||loading) return
    if(!anthropicKey.trim()){ push('assistant','🔑 请先在右上角输入 Anthropic API Key～'); return }
    setInputValue('')
    push('user',msg)
    setLoading(true)
    const hist=[...apiHistory,{role:'user',content:msg}]
    try {
      const sys=`你是"风水AI"，年轻人喜欢的赛博风水师，专业有趣有神秘感。当前房间：${describeRoom()}。用户出生年份：${birthYear||'未提供'}。回复200字以内，带emoji，给1-2个可操作建议，语气像懂风水的贴心好友。`
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:apiHdr(),body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:sys,messages:hist})})
      const d=await r.json()
      const reply=d.content?.[0]?.text||d.error?.message||'🔮 水晶球没电了，请稍后再试～'
      push('assistant',reply)
      setApiHistory([...hist,{role:'assistant',content:reply}])
    } catch { push('assistant','🔮 连接出了问题，请稍后重试～') }
    finally { setLoading(false) }
  }

  const analyzePhoto = async () => {
    if(!uploadedPhoto||loading) return
    if(!anthropicKey.trim()){ push('assistant','🔑 请先输入 Anthropic API Key～'); return }
    setLoading(true)
    push('user','📷 上传了房间照片，请分析风水',uploadedPhoto.preview)
    const sys=`你是"风水AI"，仔细分析房间照片风水。用户出生年份：${birthYear||'未提供'}。分析：①家具方位②门窗气流③风水问题④2-3改善建议。轻松有趣，带emoji，280字以内。`
    try {
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:apiHdr(),body:JSON.stringify({
        model:'claude-sonnet-4-6',max_tokens:1000,system:sys,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:uploadedPhoto.mediaType,data:uploadedPhoto.base64}},
          {type:'text',text:'请分析这个房间的风水，给出实用改善建议。'},
        ]}],
      })})
      const d=await r.json()
      const reply=d.content?.[0]?.text||d.error?.message||'🔮 分析失败，请重试'
      push('assistant',reply)
      setApiHistory(p=>[...p,{role:'user',content:'请分析我的房间风水'},{role:'assistant',content:reply}])
      setHasAnalyzed(true)
    } catch { push('assistant','🔮 照片分析出了问题，请重试～') }
    finally { setLoading(false) }
  }

  const push = (role, content, image) =>
    setMessages(p=>[...p, image ? {role,content,image} : {role,content}])

  // ── Color picker ─────────────────────────────────────────────────────────

  const triggerColor = (e,id) => {
    e.stopPropagation()
    setColorPickId(id)
    setTimeout(()=>colorInputRef.current?.click(),0)
  }

  // ── Compass ───────────────────────────────────────────────────────────────

  const Compass = () => {
    const R=22, rad=northAngle*Math.PI/180
    const pt=(a,r)=>[R+2+Math.sin(a)*r, R+2-Math.cos(a)*r]
    return (
      <svg width={R*2+4} height={R*2+4}
        style={{position:'absolute',right:8,top:8,cursor:'grab',zIndex:30,filter:'drop-shadow(1px 1px 0 rgba(0,0,0,0.15))'}}
        onMouseDown={e=>{e.stopPropagation();drag.current={mode:'compass'}}}
      >
        <rect x={2} y={2} width={R*2} height={R*2} fill="white" stroke="#111" strokeWidth={2}/>
        {[0,45,90,135,180,225,270,315].map(deg=>{
          const r=(deg-northAngle)*Math.PI/180, long=deg%90===0
          const [x1,y1]=pt(r,long?R-7:R-4), [x2,y2]=pt(r,R-2)
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={long?'#111':'#BBB'} strokeWidth={long?2:1}/>
        })}
        <polygon points={`${pt(-rad,19)} ${pt(-rad+2.65,5)} ${pt(-rad-2.65,5)}`} fill="#CC0000"/>
        <polygon points={`${pt(-rad+Math.PI,19)} ${pt(-rad+2.65,5)} ${pt(-rad-2.65,5)}`} fill="#AAA"/>
        <text x={pt(-rad,13)[0]} y={pt(-rad,13)[1]+3.5} textAnchor="middle" fontSize={7.5} fontWeight="900" fill="#CC0000" fontFamily="monospace">北</text>
        <rect x={R-2} y={R-2} width={8} height={8} fill="white" stroke="#111" strokeWidth={1.5}/>
      </svg>
    )
  }

  // ── Cursor logic ─────────────────────────────────────────────────────────

  const CURSORS = {nw:'nw-resize',ne:'ne-resize',sw:'sw-resize',se:'se-resize',move:'grab'}

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#F7F7F5',overflow:'hidden'}}>

      {/* Hidden color input */}
      <input ref={colorInputRef} type="color"
        value={colorPickId?(items.find(i=>i.id===colorPickId)?.color??'#888888'):'#888888'}
        onChange={e=>colorPickId&&setItems(p=>p.map(i=>i.id===colorPickId?{...i,color:e.target.value}:i))}
        onBlur={()=>setColorPickId(null)}
        style={{position:'fixed',opacity:0,width:1,height:1,top:0,left:0,pointerEvents:'none'}}
      />

      {/* ── Header ── */}
      <header style={{padding:'8px 24px',display:'flex',alignItems:'center',gap:16,borderBottom:'2px solid #111',background:'#FFF',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:20}}>🔮</span>
          <div>
            <h1 style={{fontSize:15,fontWeight:900,color:'#111',letterSpacing:'-0.3px',margin:0}}>风水AI</h1>
            <p style={{fontSize:7,color:'#999',letterSpacing:'2px',margin:0,fontWeight:700}}>CYBER FENG SHUI ADVISOR</p>
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#666',fontWeight:700}}>
            出生年份
            <input type="number" value={birthYear} onChange={e=>setBirthYear(e.target.value)} placeholder="2000"
              style={{width:66,padding:'4px 8px',border:'2px solid #111',background:'#FFF',fontSize:11,color:'#111',outline:'none',borderRadius:0}}/>
          </label>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#666',fontWeight:700}}>
            🔑 API KEY
            <input type="password" value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)} placeholder="sk-ant-..."
              style={{width:148,padding:'4px 8px',border:`2px solid ${anthropicKey?'#111':'#DDD'}`,background:'#FFF',fontSize:11,color:'#111',outline:'none',borderRadius:0}}/>
            {anthropicKey&&<span style={{fontSize:12,color:'#2A2'}}>✓</span>}
          </label>
        </div>
      </header>

      {/* ── Room section ── */}
      <div style={{flexShrink:0,background:'#F7F7F5',borderBottom:'2px solid #111',overflow:'auto'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 20px 10px'}}>

          {/* Toolbar */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap',maxWidth:860,width:'100%'}}>
            {/* Tab buttons */}
            {[['room','🏠 布置'],['photo','📷 照片']].map(([t,lbl])=>(
              <Btn key={t} active={tab===t} onClick={()=>setTab(t)}>{lbl}</Btn>
            ))}
            <Sep/>
            {/* Unit */}
            <span style={{fontSize:10,color:'#888',fontWeight:700}}>单位</span>
            {['cm','inch'].map(u=>(
              <Btn key={u} active={unit===u} onClick={()=>setUnit(u)}>{u==='cm'?'CM':'IN'}</Btn>
            ))}
            <Sep/>
            {/* Bagua */}
            <Btn active={showBagua} onClick={()=>setShowBagua(v=>!v)}>☯ 八卦</Btn>
            {/* Delete */}
            {selectedId&&(
              <Btn danger onClick={()=>{setItems(p=>p.filter(i=>i.id!==selectedId));setSelectedId(null)}}>🗑 删除</Btn>
            )}
            {/* Size display */}
            <span style={{marginLeft:'auto',fontSize:10,color:'#999',fontWeight:700,fontFamily:'monospace'}}>
              {fmtUnit(roomW,unit)} × {fmtUnit(roomH,unit)}
            </span>
          </div>

          {/* Palette + Room */}
          <div style={{display:'flex',gap:14,alignItems:'flex-start',maxWidth:860,width:'100%'}}>

            {/* ── Furniture palette ── */}
            <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:3}}>
              <div style={{fontSize:8,color:'#AAA',fontWeight:700,letterSpacing:'1px',marginBottom:4,textAlign:'center'}}>ADD</div>
              {FURNITURE.map(f=>{
                const light=!isDark(f.color)
                return (
                  <button key={f.type} onClick={()=>addItem(f.type)}
                    style={{padding:'4px 8px',border:'2px solid #111',background:f.color,color:light?'#111':'#EEE',fontSize:9,fontWeight:700,cursor:'pointer',borderRadius:0,textAlign:'left',display:'flex',alignItems:'center',gap:5,minWidth:80,transition:'transform 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.transform='translate(2px,-1px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='none'}
                  >
                    <span style={{fontSize:11}}>{f.emoji}</span>
                    <span>{f.label}{f.isWall?' ⌊':'  '}</span>
                  </button>
                )
              })}
            </div>

            {/* ── Room canvas area ── */}
            <div style={{flex:1,display:'flex',justifyContent:'center'}}>
              <div style={{position:'relative'}}>

                {/* Direction labels */}
                {[
                  {lbl:compassDirAt(0),   s:{top:-16,  left:'50%',transform:'translateX(-50%)'}},
                  {lbl:compassDirAt(180), s:{bottom:-16,left:'50%',transform:'translateX(-50%)'}},
                  {lbl:compassDirAt(270), s:{top:'50%', left:-22, transform:'translateY(-50%)'}},
                  {lbl:compassDirAt(90),  s:{top:'50%', right:-22,transform:'translateY(-50%)'}},
                ].map(({lbl,s},i)=>(
                  <div key={i} style={{position:'absolute',fontSize:9,fontWeight:900,color:'#CC0000',whiteSpace:'nowrap',fontFamily:'monospace',...s}}>{lbl}</div>
                ))}

                {/* Room */}
                <div ref={roomRef} onClick={()=>setSelectedId(null)}
                  style={{position:'relative',width:roomW,height:roomH,background:'#FFF',border:'3px solid #111',overflow:'hidden',userSelect:'none',
                    backgroundImage:`linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.055) 1px,transparent 1px)`,
                    backgroundSize:`${GRID}px ${GRID}px`}}
                >
                  {/* Bagua */}
                  {showBagua&&Object.entries(ZONE_LABELS).map(([zone,label])=>{
                    const [cx,cy]=ZONE_POS[zone]
                    return (
                      <div key={zone} style={{position:'absolute',left:`${cx*33.33}%`,top:`${cy*33.33}%`,width:'33.33%',height:'33.33%',border:'1px dashed rgba(0,0,0,0.12)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                        <span style={{fontSize:7.5,color:'rgba(0,0,0,0.25)',fontWeight:700,textAlign:'center',lineHeight:1.4,whiteSpace:'pre-line',fontFamily:'monospace'}}>{label.replace('·','\n')}</span>
                      </div>
                    )
                  })}

                  {/* Furniture items */}
                  {items.map(it=>{
                    const isSel=selectedId===it.id
                    const light=!isDark(it.color)
                    return (
                      <div key={it.id}
                        onMouseDown={e=>itemMouseDown(e,it.id)}
                        onDoubleClick={e=>triggerColor(e,it.id)}
                        onMouseMove={e=>{ if(drag.current) return; e.currentTarget.style.cursor=CURSORS[getCorner(e,e.currentTarget)] }}
                        style={{position:'absolute',left:it.x,top:it.y,width:it.w,height:it.h,
                          background:it.color,border:`2px solid ${isSel?'#CC0000':'rgba(0,0,0,0.45)'}`,
                          boxShadow:isSel?'0 0 0 1px #CC0000,2px 2px 0 rgba(0,0,0,0.2)':'2px 2px 0 rgba(0,0,0,0.15)',
                          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                          zIndex:isSel?50:1,userSelect:'none',borderRadius:0,
                          outline:isSel?'1px dashed #CC0000':'none',outlineOffset:isSel?'2px':'0',
                        }}
                      >
                        {/* Corner indicators when selected */}
                        {isSel&&['nw','ne','sw','se'].map(c=>(
                          <div key={c} style={{position:'absolute',width:5,height:5,background:'#CC0000',pointerEvents:'none',
                            top:c.includes('n')?-1:'auto',bottom:c.includes('s')?-1:'auto',
                            left:c.includes('w')?-1:'auto',right:c.includes('e')?-1:'auto',
                          }}/>
                        ))}
                        <span style={{fontSize:it.w>44?14:10,lineHeight:1,userSelect:'none'}}>{it.emoji}</span>
                        {it.w>32&&it.h>26&&(
                          <span style={{fontSize:7.5,color:light?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.8)',fontWeight:700,fontFamily:'monospace',marginTop:2,letterSpacing:'0.3px',userSelect:'none'}}>{it.label}</span>
                        )}
                      </div>
                    )
                  })}

                  <Compass/>
                </div>

                {/* Room resize handles */}
                <div onMouseDown={e=>roomEdgeDown(e,'room-e')} style={{position:'absolute',right:-9,top:'35%',width:7,height:28,background:'#111',cursor:'ew-resize',zIndex:20}}/>
                <div onMouseDown={e=>roomEdgeDown(e,'room-s')} style={{position:'absolute',bottom:-9,left:'35%',width:28,height:7,background:'#111',cursor:'ns-resize',zIndex:20}}/>
                <div onMouseDown={e=>roomEdgeDown(e,'room-se')} style={{position:'absolute',right:-9,bottom:-9,width:11,height:11,background:'#CC0000',cursor:'nwse-resize',zIndex:21}}/>
              </div>
            </div>

            {/* ── Photo tab content (right side) ── */}
            {tab==='photo'&&(
              <div style={{flexShrink:0,width:220,display:'flex',flexDirection:'column',gap:8}}>
                <div onClick={()=>fileInputRef.current?.click()}
                  style={{width:'100%',height:150,border:`2px dashed ${uploadedPhoto?'#111':'#CCC'}`,background:'#FAFAFA',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',position:'relative'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#111'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=uploadedPhoto?'#111':'#CCC'}
                >
                  {uploadedPhoto?(
                    <img src={uploadedPhoto.preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  ):(
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:28,marginBottom:4}}>📷</div>
                      <p style={{fontSize:10,fontWeight:700,color:'#555'}}>点击上传照片</p>
                      <p style={{fontSize:8,color:'#AAA',marginTop:2}}>JPG / PNG</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={e=>{
                  const f=e.target.files[0]; if(!f) return
                  const r=new FileReader()
                  r.onload=()=>{ setUploadedPhoto({base64:r.result.split(',')[1],mediaType:f.type,preview:r.result}); setHasAnalyzed(false) }
                  r.readAsDataURL(f)
                }} style={{display:'none'}}/>
                {uploadedPhoto&&<Btn onClick={analyzePhoto} disabled={loading}>{loading?'🔮 分析中...':'🔍 分析风水'}</Btn>}
                {hasAnalyzed&&!showOAIKey&&<Btn onClick={()=>setShowOAIKey(true)}>🔑 OpenAI Key → 效果图</Btn>}
                {showOAIKey&&(
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <input type="password" value={openaiKey} onChange={e=>setOpenaiKey(e.target.value)} placeholder="sk-..."
                      style={{padding:'6px 8px',border:'2px solid #111',background:'#FFF',fontSize:10,fontFamily:'monospace',outline:'none',borderRadius:0}}/>
                    <Btn disabled={!openaiKey||generatingImage} onClick={async()=>{
                      if(!openaiKey||generatingImage) return
                      setGeneratingImage(true)
                      push('user','🎨 帮我生成风水改造后的效果图')
                      try {
                        const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${openaiKey}`},body:JSON.stringify({model:'dall-e-3',prompt:'A cozy room with perfect feng shui, pixel art isometric style, monochrome black white gray palette, clean minimal. No text.',n:1,size:'1024x1024',quality:'standard'})})
                        const d=await r.json()
                        if(d.data?.[0]?.url) push('assistant','✨ 效果图来了！',d.data[0].url)
                        else throw new Error()
                      } catch { push('assistant','🎨 生成失败，请检查 OpenAI Key') }
                      finally { setGeneratingImage(false) }
                    }}>{generatingImage?'✨ 生成中...':'✨ 生成效果图'}</Btn>
                  </div>
                )}
                <p style={{fontSize:8,color:'#BBB',fontWeight:700,lineHeight:1.6}}>Key 仅本次会话使用，不储存</p>
              </div>
            )}
          </div>

          {/* Hint */}
          <p style={{marginTop:10,fontSize:9,color:'#BBB',fontWeight:700,letterSpacing:'0.3px',fontFamily:'monospace'}}>
            双击家具改色 · 角落拖动缩放 · 中间拖动移位 · 拖罗盘设朝向
          </p>
        </div>
      </div>

      {/* ── Chat section ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,background:'#FFF'}}>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 24px',display:'flex',flexDirection:'column',gap:10}}>
          {messages.map((msg,i)=>(
            <div key={i} style={{display:'flex',flexDirection:msg.role==='user'?'row-reverse':'row',gap:8,alignItems:'flex-start'}}>
              {msg.role==='assistant'&&(
                <div style={{width:26,height:26,border:'2px solid #111',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>🔮</div>
              )}
              <div style={{maxWidth:'72%',display:'flex',flexDirection:'column',alignItems:msg.role==='user'?'flex-end':'flex-start',gap:4}}>
                <div style={{padding:'8px 12px',border:'2px solid #111',background:msg.role==='user'?'#111':'#FFF',color:msg.role==='user'?'#FFF':'#111',fontSize:12.5,lineHeight:1.65,whiteSpace:'pre-wrap',fontFamily:'monospace',borderRadius:0,
                  boxShadow:msg.role==='user'?'-2px 2px 0 rgba(0,0,0,0.15)':'2px 2px 0 rgba(0,0,0,0.06)'}}>
                  {msg.content}
                </div>
                {msg.image&&<img src={msg.image} alt="" style={{maxWidth:'100%',border:'2px solid #111',maxHeight:200,objectFit:'cover'}}/>}
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              <div style={{width:26,height:26,border:'2px solid #111',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>🔮</div>
              <div style={{padding:'8px 12px',border:'2px solid #111',background:'#FFF',display:'flex',gap:4,alignItems:'center'}}>
                {[0,1,2].map(n=><div key={n} style={{width:5,height:5,background:'#111',animation:`bounce 1.2s ease-in-out ${n*0.2}s infinite`}}/>)}
              </div>
            </div>
          )}
          <div ref={chatEndRef}/>
        </div>

        {/* Quick prompts */}
        <div style={{padding:'0 24px 8px',display:'flex',gap:6,flexWrap:'wrap'}}>
          {QUICK.map(p=>(
            <button key={p} onClick={()=>sendMessage(p)} disabled={loading}
              style={{padding:'4px 10px',border:'2px solid #111',background:'#FFF',color:'#111',fontFamily:'monospace',fontSize:10.5,fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?0.5:1,borderRadius:0,transition:'all 0.1s'}}
              onMouseEnter={e=>{if(!loading){e.currentTarget.style.background='#111';e.currentTarget.style.color='#FFF'}}}
              onMouseLeave={e=>{e.currentTarget.style.background='#FFF';e.currentTarget.style.color='#111'}}
            >{p}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{padding:'6px 24px 12px',display:'flex',gap:8,borderTop:'2px solid #EEE'}}>
          <input value={inputValue} onChange={e=>setInputValue(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
            placeholder="告诉我你的困惑…"
            style={{flex:1,padding:'9px 14px',border:'2px solid #111',background:'#FFF',fontSize:12,color:'#111',outline:'none',fontFamily:'monospace',borderRadius:0}}
          />
          <button onClick={()=>sendMessage()} disabled={loading||!inputValue.trim()}
            style={{padding:'9px 18px',border:'2px solid #111',background:(loading||!inputValue.trim())?'#EEE':'#111',color:(loading||!inputValue.trim())?'#AAA':'#FFF',fontFamily:'monospace',fontSize:12,fontWeight:700,cursor:(loading||!inputValue.trim())?'not-allowed':'pointer',borderRadius:0,whiteSpace:'nowrap'}}
          >{loading?'…':'问一问 ✨'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Mini components ──────────────────────────────────────────────────────────

function Btn({ children, active, danger, disabled, onClick }) {
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{padding:'4px 10px',border:`2px solid ${danger?'#CC0000':'#111'}`,fontFamily:'monospace',fontSize:10.5,fontWeight:700,cursor:disabled?'not-allowed':'pointer',borderRadius:0,transition:'all 0.1s',
        background: active?'#111':danger?'#CC0000':disabled?'#EEE':'#FFF',
        color: active?'#FFF':danger?'#FFF':disabled?'#AAA':'#111',
        opacity:disabled?0.6:1,
      }}
    >{children}</button>
  )
}

function Sep() {
  return <div style={{width:1,height:18,background:'#DDD',flexShrink:0}}/>
}
