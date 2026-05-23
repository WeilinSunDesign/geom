import { useState, useRef, useCallback, useEffect } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_ROOM_W = 240, MIN_ROOM_H = 160, MAX_ROOM_W = 640, MAX_ROOM_H = 480
const MIN_W = 18, MIN_H = 18
const CORNER_HIT = 14
const GRID = 16
const PX_PER_CM = 1
const MIN_PANEL = 300

// Color palette — mirrors :root CSS vars in index.css
const COLOR_PALETTE = [
  '#FF2D78', // hot pink
  '#FF5C5C', // coral red
  '#FF8C33', // orange
  '#FFE134', // yellow
  '#C8EC28', // lime
  '#3DD68C', // green
  '#2ECFBD', // teal
  '#38D5F0', // cyan
  '#5B8EFF', // blue
  '#9B5DE5', // purple
  '#E8A0FF', // lavender
  '#FFF0CC', // cream
  '#111111', // black
]

const FURNITURE = [
  { type:'bed',      emoji:'🛏', w:88, h:64,  color:'#FF2D78', isWall:false },
  { type:'desk',     emoji:'🖥', w:76, h:52,  color:'#5B8EFF', isWall:false },
  { type:'wardrobe', emoji:'🗄', w:52, h:84,  color:'#9B5DE5', isWall:false },
  { type:'sofa',     emoji:'🛋', w:92, h:52,  color:'#FF8C33', isWall:false },
  { type:'plant',    emoji:'🌿', w:36, h:36,  color:'#3DD68C', isWall:false },
  { type:'lamp',     emoji:'💡', w:28, h:28,  color:'#FFE134', isWall:false },
  { type:'mirror',   emoji:'🪞', w:28, h:62,  color:'#38D5F0', isWall:false },
  { type:'crystal',  emoji:'🔮', w:26, h:26,  color:'#E8A0FF', isWall:false },
  { type:'door',     emoji:'🚪', w:48, h:10,  color:'#FF5C5C', isWall:true  },
  { type:'window',   emoji:'🪟', w:58, h:10,  color:'#2ECFBD', isWall:true  },
]

const SCREEN_ANGLES = [[315,0,45],[270,null,90],[225,180,135]]
const COMPASS_ZONES  = ['N','NE','E','SE','S','SW','W','NW']

const getZone = (xP, yP, na=0) => {
  const col=xP<33?0:xP<67?1:2, row=yP<33?0:yP<67?1:2
  if (col===1&&row===1) return 'C'
  const sa=SCREEN_ANGLES[row][col]
  return COMPASS_ZONES[Math.round((((na+sa)%360)+360)%360/45)%8]
}

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
  if (!hex || !hex.startsWith('#')) return false
  const v = parseInt(hex.replace('#',''), 16)
  const r=(v>>16)&255, g=(v>>8)&255, b=v&255
  return (r*299+g*587+b*114)/1000 < 128
}

const toCm  = px => Math.round(px * PX_PER_CM)
const toIn  = px => (px * PX_PER_CM / 2.54).toFixed(1)
const fmtUnit = (px, unit) => unit==='cm' ? `${toCm(px)} cm` : `${toIn(px)}"`

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    appName: 'GEOM',
    appSub: 'CYBER FENG SHUI ADVISOR',
    langBtn: '中文',
    birthYear: 'Birth Year',
    tabRoom: '🏠 Room',
    unit: 'Unit',
    bagua: '☯ Bagua',
    add: 'ADD',
    hint: 'Double-click furniture to recolour · Drag corners to resize · Drag centre to move · Drag compass to set direction',
    placeholder: 'Tell me your concerns…',
    sendBtn: '✨ Ask',
    canvasHint: '📐 Recreate your bedroom layout — add furniture, doors & windows, then ask for feng shui advice',
    initMsg: '✨ Hey, I\'m GEOM.\n\nSet up your bedroom layout above, then tell me what\'s on your mind 🌙\n\n💡 Double-click any furniture to change its colour',
    customBtn: '+ Custom',
    customTitle: 'Custom Furniture',
    iconLabel: 'Icon',
    nameLabel: 'Name',
    wLabel: 'W',
    hLabel: 'H',
    cancelBtn: 'Cancel',
    addBtn: 'Add to Room',
    namePlaceholder: 'e.g. Bookshelf',
    floor: 'Floor',
    quick: ['Analyse my whole room', 'Struggling with love lately 😭', 'Work keeps going wrong', 'Sleeping badly', 'Bad fortune'],
    zones: {
      NW:'Qián·Patrons', N:'Kǎn·Career', NE:'Gèn·Knowledge',
      W:'Duì·Creativity', C:'Centre·Health', E:'Zhèn·Family',
      SW:'Kūn·Love', S:'Lí·Fame', SE:'Xùn·Wealth',
    },
    compass: ['N','NE','E','SE','S','SW','W','NW'],
    furniture: { bed:'Bed', desk:'Desk', wardrobe:'Wardrobe', sofa:'Sofa', plant:'Plant', lamp:'Lamp', mirror:'Mirror', crystal:'Crystal', door:'Door', window:'Window' },
    sysPrompt: (room, birth) => `You are GEOM, a stylish cyber feng shui intelligence. Always refer to yourself as GEOM. Room layout: ${room}. User birth year: ${birth||'not provided'}. Reply in English, under 200 words, with 1-2 actionable tips. Confident, a little mystical. Use emoji.`,
    errConn: '🔮 Connection issue, please try again~',
    errCrystal: '🔮 The crystal ball went dark, please try again~',
    errPhoto: '🔮 Photo analysis failed, please retry~',
  },
  zh: {
    appName: 'GEOM',
    appSub: 'CYBER FENG SHUI ADVISOR',
    langBtn: 'EN',
    birthYear: '出生年份',
    tabRoom: '🏠 布置',
    unit: '单位',
    bagua: '☯ 八卦',
    add: 'ADD',
    hint: '双击家具改色 · 角落拖动缩放 · 中间拖动移位 · 拖罗盘设朝向',
    placeholder: '告诉我你的困惑…',
    sendBtn: '问一问 ✨',
    canvasHint: '📐 先还原你的卧室布局 — 添加家具、门和窗，然后向我提问',
    initMsg: '✨ 嗨，我是 GEOM。\n\n先把卧室布置好，然后告诉我你的困惑 🌙\n\n💡 双击家具可以换颜色',
    customBtn: '+ 自定义',
    customTitle: '自定义家具',
    iconLabel: '图标',
    nameLabel: '名称',
    wLabel: '宽',
    hLabel: '高',
    cancelBtn: '取消',
    addBtn: '添加到房间',
    namePlaceholder: '如：书架',
    floor: '地板',
    quick: ['帮我全面分析我的房间','最近烂桃花 😭','工作总不顺','睡眠很差','财运不好'],
    zones: {
      NW:'乾·贵人', N:'坎·事业', NE:'艮·学识',
      W:'兑·创意', C:'中·健康', E:'震·家庭',
      SW:'坤·爱情', S:'离·名声', SE:'巽·财富',
    },
    compass: ['北','东北','东','东南','南','西南','西','西北'],
    furniture: { bed:'床', desk:'书桌', wardrobe:'衣柜', sofa:'沙发', plant:'绿植', lamp:'灯', mirror:'镜子', crystal:'水晶', door:'门', window:'窗' },
    sysPrompt: (room, birth) => `你是GEOM，一个赛博风水智能，始终自称GEOM。当前房间：${room}。用户出生年份：${birth||'未提供'}。回复200字以内，带emoji，给1-2个可操作建议，风格自信神秘有个性。`,
    errConn: '🔮 连接出了问题，请稍后重试～',
    errCrystal: '🔮 水晶球没电了，请稍后再试～',
    errPhoto: '🔮 照片分析出了问题，请重试～',
  },
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [lang,        setLang]        = useState('en')
  const t = T[lang]

  const [roomW,      setRoomW]      = useState(460)
  const [roomH,      setRoomH]      = useState(340)
  const [northAngle, setNorthAngle] = useState(0)
  const [showBagua,  setShowBagua]  = useState(false)
  const [unit,       setUnit]       = useState('cm')
  const [selectedId, setSelectedId] = useState(null)
  const [floorColor, setFloorColor] = useState('#F5F5F5')

  const [splitPct, setSplitPct] = useState(61.8)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  // Color swatch picker (replaces HTML color input)
  const [colorPickId,    setColorPickId]    = useState(null)
  const [colorSwatchPos, setColorSwatchPos] = useState(null) // {x, y} in room coords

  const [items, setItems] = useState([
    { id:'1', type:'bed',      emoji:'🛏', x:28,  y:52,  w:88, h:64, color:'#FF2D78', isWall:false, rotation:0 },
    { id:'2', type:'desk',     emoji:'🖥', x:270, y:28,  w:76, h:52, color:'#5B8EFF', isWall:false, rotation:0 },
    { id:'3', type:'plant',    emoji:'🌿', x:370, y:244, w:36, h:36, color:'#3DD68C', isWall:false, rotation:0 },
    { id:'4', type:'wardrobe', emoji:'🗄', x:28,  y:228, w:52, h:84, color:'#9B5DE5', isWall:false, rotation:0 },
    { id:'5', type:'door',     emoji:'🚪', x:162, y:0,   w:48, h:10, color:'#FF5C5C', isWall:true,  rotation:0 },
    { id:'6', type:'window',   emoji:'🪟', x:290, y:330, w:58, h:10, color:'#2ECFBD', isWall:true,  rotation:0 },
  ])

  const drag           = useRef(null)
  const splitDrag      = useRef(null)
  const roomRef        = useRef(null)
  const splitContainerRef = useRef(null)
  const chatEndRef     = useRef(null)
  const longPressTimer = useRef(null)
  const pendingMove    = useRef(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [movingId,        setMovingId]        = useState(null)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customForm,      setCustomForm]      = useState({ emoji:'📦', name:'', w:60, h:60 })

  const [birthYear,     setBirthYear]     = useState('')
  const [inputValue,    setInputValue]    = useState('')
  const [loading,       setLoading]       = useState(false)
  const [messages,      setMessages]      = useState([
    { role:'assistant', content: T.en.initMsg },
  ])
  const [apiHistory, setApiHistory] = useState([])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Drag ─────────────────────────────────────────────────────────────────

  const getCorner = (e, el) => {
    const r = el.getBoundingClientRect()
    const lx = e.clientX-r.left, ly = e.clientY-r.top
    const w = r.width, h = r.height, z = CORNER_HIT
    if (lx<z&&ly<z) return 'nw'
    if (lx>w-z&&ly<z) return 'ne'
    if (lx<z&&ly>h-z) return 'sw'
    if (lx>w-z&&ly>h-z) return 'se'
    return 'move'
  }

  const itemMouseDown = (e, id) => {
    if (e.detail === 2) return
    e.preventDefault(); e.stopPropagation()
    setSelectedId(id)
    setConfirmDeleteId(null)
    const corner = getCorner(e, e.currentTarget)
    const it = items.find(i=>i.id===id)
    drag.current = {
      mode: corner==='move' ? 'move' : `resize-${corner}`,
      id, sx:e.clientX, sy:e.clientY,
      orig:{ x:it.x, y:it.y, w:it.w, h:it.h, roomW, roomH },
    }
  }

  const roomEdgeDown = (e, mode) => {
    e.preventDefault()
    drag.current = { mode, id:null, sx:e.clientX, sy:e.clientY, orig:{ roomW, roomH } }
  }

  const onSplitMouseDown = useCallback((e) => {
    e.preventDefault()
    splitDrag.current = true
  }, [])

  const onMouseMove = useCallback((e) => {
    if (splitDrag.current && splitContainerRef.current) {
      const rect = splitContainerRef.current.getBoundingClientRect()
      const newPct = ((e.clientX - rect.left) / rect.width) * 100
      const minPct = (MIN_PANEL / rect.width) * 100
      setSplitPct(Math.max(minPct, Math.min(100 - minPct, newPct)))
      return
    }
    const d = drag.current; if (!d) return
    const dx=e.clientX-d.sx, dy=e.clientY-d.sy
    if (d.id && (Math.abs(dx)>2||Math.abs(dy)>2)) setMovingId(d.id)

    if (d.mode==='rotate') {
      const angle = Math.atan2(e.clientX-d.cx, -(e.clientY-d.cy)) * 180/Math.PI
      const snapped = (Math.round(angle/45)*45 % 360 + 360) % 360
      setItems(prev=>prev.map(it=>it.id===d.id ? {...it,rotation:snapped} : it))
      return
    }
    if (d.mode==='compass') {
      const currentAngle = Math.atan2(e.clientX-d.cx, -(e.clientY-d.cy)) * 180 / Math.PI
      const raw = ((d.startNorth - (currentAngle - d.startAngle)) % 360 + 360) % 360
      setNorthAngle(Math.round(raw / 45) * 45 % 360)
      return
    }
    if      (d.mode==='room-e')  setRoomW(()=>clamp(d.orig.roomW+dx, MIN_ROOM_W, MAX_ROOM_W))
    else if (d.mode==='room-s')  setRoomH(()=>clamp(d.orig.roomH+dy, MIN_ROOM_H, MAX_ROOM_H))
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

  const onMouseUp = useCallback(()=>{
    splitDrag.current = null
    drag.current = null
    setMovingId(null)
  },[])

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
    const f = FURNITURE.find(f=>f.type===type)
    const sx = f.isWall ? roomW/2-f.w/2 : 80+Math.random()*100
    const sy = f.isWall ? 0 : 60+Math.random()*80
    const pos = f.isWall ? snapToWall(f,sx,sy,roomW,roomH) : {x:sx,y:sy}
    setItems(p=>[...p,{id:Date.now().toString(),...f,...pos,rotation:0}])
  }

  const compassDirAt = off => t.compass[Math.round(((northAngle+off)+360)%360/45)%8]

  const describeRoom = () =>
    `top=${compassDirAt(0)}, ${toCm(roomW)}×${toCm(roomH)}cm, ` +
    items.map(it=>{
      const xP=((it.x+it.w/2)/roomW)*100, yP=((it.y+it.h/2)/roomH)*100
      return `${it.customLabel||t.furniture[it.type]}→${t.zones[getZone(xP,yP,northAngle)]}`
    }).join(', ')

  // ── API ──────────────────────────────────────────────────────────────────

  const sendMessage = async txt => {
    const msg=(txt||inputValue).trim(); if(!msg||loading) return
    setInputValue('')
    push('user',msg)
    setLoading(true)
    const hist=[...apiHistory,{role:'user',content:msg}]
    try {
      const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:t.sysPrompt(describeRoom(),birthYear),messages:hist})})
      const d=await r.json()
      const reply=d.content?.[0]?.text||d.error?.message||t.errCrystal
      push('assistant',reply)
      setApiHistory([...hist,{role:'assistant',content:reply}])
    } catch { push('assistant',t.errConn) }
    finally { setLoading(false) }
  }

  const push = (role, content) => setMessages(p=>[...p,{role,content}])

  const addCustomItem = () => {
    if (!customForm.name.trim()) return
    const w = Math.max(18, Math.min(200, customForm.w))
    const h = Math.max(18, Math.min(200, customForm.h))
    setItems(p=>[...p, {
      id: Date.now().toString(), type:'custom',
      emoji: customForm.emoji||'📦', customLabel: customForm.name.trim(),
      x: clamp(80+Math.random()*80, 0, roomW-w),
      y: clamp(60+Math.random()*80, 0, roomH-h),
      w, h, color:'#FF2D78', isWall:false, rotation:0,
    }])
    setShowCustomModal(false)
    setCustomForm({ emoji:'📦', name:'', w:60, h:60 })
  }

  // ── Color swatch picker ───────────────────────────────────────────────────

  const triggerColor = (e, id) => {
    e.stopPropagation()
    const it = items.find(i => i.id === id)
    if (!it) return
    const popW = 163
    const x = Math.max(0, Math.min(roomW - popW, it.x + it.w/2 - popW/2))
    const y = it.y >= 94 ? it.y - 94 : it.y + it.h + 6
    setColorPickId(id)
    setColorSwatchPos({ x, y })
  }

  const closeColorSwatch = () => { setColorPickId(null); setColorSwatchPos(null) }

  const applyColor = col => {
    setItems(p => p.map(i => i.id===colorPickId ? {...i, color:col} : i))
    closeColorSwatch()
  }

  // ── Compass ───────────────────────────────────────────────────────────────

  const Compass = () => {
    const R=22, rad=northAngle*Math.PI/180
    const pt=(a,r)=>[R+2+Math.sin(a)*r, R+2-Math.cos(a)*r]
    return (
      <svg width={R*2+4} height={R*2+4}
        style={{cursor:'grab',display:'block',flexShrink:0,filter:'drop-shadow(1px 1px 0 rgba(255,45,120,0.4))'}}
        onMouseDown={e=>{
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          const cx = rect.left+R+2, cy = rect.top+R+2
          drag.current = { mode:'compass', cx, cy,
            startAngle: Math.atan2(e.clientX-cx, -(e.clientY-cy)) * 180 / Math.PI,
            startNorth: northAngle,
          }
        }}
      >
        <rect x={2} y={2} width={R*2} height={R*2} fill="#000000" stroke="rgba(255,255,255,0.4)" strokeWidth={2}/>
        {[0,45,90,135,180,225,270,315].map(deg=>{
          const r=(deg-northAngle)*Math.PI/180, long=deg%90===0
          const [x1,y1]=pt(r,long?R-7:R-4), [x2,y2]=pt(r,R-2)
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={long?'#FFF0CC':'rgba(255,240,204,0.3)'} strokeWidth={long?2:1}/>
        })}
        <polygon points={`${pt(-rad,19)} ${pt(-rad+2.65,5)} ${pt(-rad-2.65,5)}`} fill="#FF2D78"/>
        <polygon points={`${pt(-rad+Math.PI,19)} ${pt(-rad+2.65,5)} ${pt(-rad-2.65,5)}`} fill="#2ECFBD"/>
        <text x={pt(-rad,13)[0]} y={pt(-rad,13)[1]+3.5} textAnchor="middle" fontSize={7.5} fontWeight="900" fill="#FFE134" fontFamily="monospace">{t.compass[0]}</text>
        <rect x={R-2} y={R-2} width={8} height={8} fill="#000000" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5}/>
      </svg>
    )
  }

  const CURSORS = {nw:'nw-resize',ne:'ne-resize',sw:'sw-resize',se:'se-resize',move:'grab'}

  // ── Render ────────────────────────────────────────────────────────────────

  const floorIsDark = isDark(floorColor)

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#000000',overflow:'hidden'}}>

      {/* ── Custom furniture modal ── */}
      {showCustomModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setShowCustomModal(false)}>
          <div style={{background:'#111111',border:'2px solid #FF2D78',padding:24,width:320,boxShadow:'6px 6px 0 rgba(255,45,120,0.3)',fontFamily:'monospace'}}
            onClick={e=>e.stopPropagation()}>
            <h2 style={{margin:'0 0 18px',fontSize:15,fontWeight:900,letterSpacing:'-0.3px',color:'#FFF0CC'}}>{t.customTitle}</h2>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:'#7777A0',letterSpacing:'1px',marginBottom:6}}>{t.iconLabel}</div>
              <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:24,width:38,height:38,border:'2px solid #FF2D78',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{customForm.emoji}</div>
                <input value={customForm.emoji} onChange={e=>setCustomForm(f=>({...f,emoji:e.target.value}))}
                  style={{width:52,padding:'6px 8px',border:'2px solid #FF2D78',background:'#000000',color:'#FFF0CC',fontFamily:'monospace',fontSize:18,outline:'none',borderRadius:0,textAlign:'center'}}
                  maxLength={2}/>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                {['🛋','🛏','🖥','🗄','🚪','🪟','🌿','💡','🪞','🔮','🛁','🪑','📺','🪴','🎸','📚','💻','🎮','🖼','🧺','🎹','🎨','🧸','🚿'].map(em=>(
                  <button key={em} onClick={()=>setCustomForm(f=>({...f,emoji:em}))}
                    style={{fontSize:16,width:30,height:30,border:`2px solid ${customForm.emoji===em?'#FFE134':'rgba(255,255,255,0.15)'}`,background:customForm.emoji===em?'#FFE134':'transparent',cursor:'pointer',borderRadius:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.1s'}}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:'#7777A0',letterSpacing:'1px',marginBottom:6}}>{t.nameLabel}</div>
              <input value={customForm.name} onChange={e=>setCustomForm(f=>({...f,name:e.target.value}))}
                placeholder={t.namePlaceholder} maxLength={12}
                onKeyDown={e=>e.key==='Enter'&&addCustomItem()}
                style={{width:'100%',padding:'8px 10px',border:'2px solid #FF2D78',background:'#000000',color:'#FFF0CC',fontFamily:'monospace',fontSize:13,outline:'none',borderRadius:0,boxSizing:'border-box'}}/>
            </div>

            <div style={{marginBottom:20,display:'flex',gap:10}}>
              {[['w',t.wLabel],[' h',t.hLabel]].map(([k,lbl])=>(
                <div key={k} style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#7777A0',letterSpacing:'1px',marginBottom:6}}>{lbl} (px)</div>
                  <input type="number" value={customForm[k.trim()]} min={18} max={200}
                    onChange={e=>setCustomForm(f=>({...f,[k.trim()]:Math.max(18,Math.min(200,+e.target.value||18))}))}
                    style={{width:'100%',padding:'8px 10px',border:'2px solid #FF2D78',background:'#000000',color:'#FFF0CC',fontFamily:'monospace',fontSize:13,outline:'none',borderRadius:0,boxSizing:'border-box'}}/>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowCustomModal(false)}
                style={{padding:'8px 16px',border:'2px solid rgba(255,255,255,0.25)',background:'transparent',color:'#FFF0CC',fontFamily:'monospace',fontSize:12,fontWeight:700,cursor:'pointer',borderRadius:0}}>
                {t.cancelBtn}
              </button>
              <button onClick={addCustomItem} disabled={!customForm.name.trim()}
                style={{padding:'8px 16px',border:'2px solid #FF2D78',background:customForm.name.trim()?'#FF2D78':'rgba(255,45,120,0.2)',color:customForm.name.trim()?'#FFF':'rgba(255,240,204,0.3)',fontFamily:'monospace',fontSize:12,fontWeight:700,cursor:customForm.name.trim()?'pointer':'not-allowed',borderRadius:0}}>
                {t.addBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{padding:'8px 24px',display:'flex',alignItems:'center',gap:16,borderBottom:'2px solid rgba(255,255,255,0.2)',background:'#000000',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src="/logo.svg" style={{width:26,height:26,objectFit:'contain',flexShrink:0}} alt="GEOM"/>
          <div>
            <h1 style={{fontSize:17,fontWeight:900,color:'#FFF0CC',letterSpacing:'-0.3px',margin:0}}>{t.appName}</h1>
            <p style={{fontSize:8,color:'#FF2D78',letterSpacing:'2px',margin:0,fontWeight:700}}>{t.appSub}</p>
          </div>
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#7777A0',fontWeight:700}}>
            {t.birthYear}
            <input type="number" value={birthYear} onChange={e=>setBirthYear(e.target.value)} placeholder="2000"
              style={{width:68,padding:'4px 8px',border:'2px solid #FF2D78',background:'#000000',fontSize:12,color:'#FFF0CC',outline:'none',borderRadius:0}}/>
          </label>
          <button onClick={()=>setLang(l=>l==='en'?'zh':'en')}
            style={{padding:'5px 14px',border:'2px solid #2ECFBD',background:'transparent',color:'#2ECFBD',fontFamily:'monospace',fontSize:11,fontWeight:700,cursor:'pointer',borderRadius:0,transition:'all 0.1s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='#2ECFBD';e.currentTarget.style.color='#000000'}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#2ECFBD'}}
          >{t.langBtn}</button>
        </div>
      </header>

      {/* ── Main split area ── */}
      <div ref={splitContainerRef} style={{flex:1,display:'flex',flexDirection:isMobile?'column':'row',minHeight:0,overflow:'hidden'}}>

        {/* ── Room panel ── */}
        <div style={isMobile ? {
          flexShrink:0,overflow:'auto',background:'#000000',borderBottom:'2px solid rgba(255,255,255,0.2)',
        } : {
          width:`${splitPct}%`,minWidth:MIN_PANEL,flexShrink:0,overflow:'auto',
          background:'#000000',borderRight:'2px solid rgba(255,255,255,0.2)',
        }}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 20px 10px'}}>

            {/* Toolbar row 1 */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap',maxWidth:860,width:'100%'}}>
              <Btn active={true}>{t.tabRoom}</Btn>
              <Sep/>
              <span style={{fontSize:11,color:'#7777A0',fontWeight:700}}>{t.unit}</span>
              {['cm','inch'].map(u=>(
                <Btn key={u} active={unit===u} onClick={()=>setUnit(u)}>{u==='cm'?'CM':'IN'}</Btn>
              ))}
              <Sep/>
              <Btn active={showBagua} onClick={()=>setShowBagua(v=>!v)}>{t.bagua}</Btn>
              <span style={{marginLeft:'auto',fontSize:11,color:'#7777A0',fontWeight:700,fontFamily:'monospace'}}>
                {(()=>{ const it=items.find(i=>i.id===selectedId); return it ? `${fmtUnit(it.w,unit)} × ${fmtUnit(it.h,unit)}` : `${fmtUnit(roomW,unit)} × ${fmtUnit(roomH,unit)}` })()}
              </span>
            </div>

            {/* Toolbar row 2 — floor color */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,maxWidth:860,width:'100%',flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'#7777A0',fontWeight:700,letterSpacing:'0.5px'}}>{t.floor}</span>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                {[
                  { col:'#F5F5F5', label:'White' },
                  { col:'#888888', label:'Grey'  },
                  { col:'#111111', label:'Black' },
                ].map(({col,label})=>(
                  <div key={col} onClick={()=>setFloorColor(col)}
                    title={label}
                    style={{
                      width:22,height:22,background:col,cursor:'pointer',flexShrink:0,
                      border:`2px solid ${floorColor===col?'#FFE134':'rgba(255,255,255,0.18)'}`,
                      boxShadow:floorColor===col?'0 0 0 1px #FFE134':'none',
                      transition:'transform 0.1s',
                    }}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.2)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='none'}
                  />
                ))}
              </div>
            </div>

            {/* Canvas hint + compass */}
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10,maxWidth:860,width:'100%'}}>
              <p style={{margin:0,fontSize:11,color:'#7777A0',fontWeight:700,fontFamily:'monospace',flex:1,textAlign:'left'}}>
                {t.canvasHint}
              </p>
              <Compass/>
            </div>

            {/* Palette + Room */}
            <div style={{display:'flex',gap:14,alignItems:'flex-start',maxWidth:860,width:'100%'}}>

              {/* ── Furniture palette ── */}
              <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:3}}>
                <div style={{fontSize:9,color:'#7777A0',fontWeight:700,letterSpacing:'1px',marginBottom:4,textAlign:'center'}}>{t.add}</div>
                {FURNITURE.map(f=>(
                  <button key={f.type} onClick={()=>addItem(f.type)}
                    style={{padding:'5px 9px',border:`2px solid ${f.color}`,background:'transparent',color:'#FFF0CC',fontSize:11,fontWeight:700,cursor:'pointer',borderRadius:0,textAlign:'left',display:'flex',alignItems:'center',gap:5,minWidth:86,transition:'all 0.1s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background=f.color;e.currentTarget.style.color=isDark(f.color)?'#FFF':'#111'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#FFF0CC'}}
                  >
                    <img src={`/icons/${f.type}.svg`} style={{width:14,height:14,objectFit:'contain',flexShrink:0,filter:'invert(1) sepia(1) saturate(0) brightness(2)'}} alt=""/>
                    <span>{t.furniture[f.type]}{f.isWall?' ⌊':'  '}</span>
                  </button>
                ))}
                <button onClick={()=>setShowCustomModal(true)}
                  style={{padding:'5px 9px',border:'2px dashed rgba(255,255,255,0.2)',background:'transparent',color:'#7777A0',fontSize:11,fontWeight:700,cursor:'pointer',borderRadius:0,textAlign:'left',display:'flex',alignItems:'center',gap:5,minWidth:86,marginTop:4,transition:'all 0.1s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#FF2D78';e.currentTarget.style.color='#FF2D78'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.2)';e.currentTarget.style.color='#7777A0'}}
                >
                  <span style={{fontSize:12}}>✚</span>
                  <span>{t.customBtn}</span>
                </button>
              </div>

              {/* ── Room canvas ── */}
              <div style={{flex:1,display:'flex',justifyContent:'center'}}>
                <div style={{position:'relative'}}>

                  {/* Direction labels */}
                  {[
                    {lbl:compassDirAt(0),   s:{top:-18,  left:'50%',transform:'translateX(-50%)'}},
                    {lbl:compassDirAt(180), s:{bottom:-18,left:'50%',transform:'translateX(-50%)'}},
                    {lbl:compassDirAt(270), s:{top:'50%', left:-24, transform:'translateY(-50%)'}},
                    {lbl:compassDirAt(90),  s:{top:'50%', right:-24,transform:'translateY(-50%)'}},
                  ].map(({lbl,s},i)=>(
                    <div key={i} style={{position:'absolute',fontSize:10,fontWeight:900,color:'#FFE134',whiteSpace:'nowrap',fontFamily:'monospace',...s}}>{lbl}</div>
                  ))}

                  {/* Room */}
                  <div ref={roomRef}
                    onClick={()=>{setSelectedId(null);setConfirmDeleteId(null);closeColorSwatch()}}
                    style={{
                      position:'relative',width:roomW,height:roomH,
                      background:floorColor,
                      border:'2px solid rgba(255,255,255,0.45)',
                      overflow:'hidden',userSelect:'none',
                      backgroundImage:`linear-gradient(${floorIsDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'} 1px,transparent 1px),linear-gradient(90deg,${floorIsDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'} 1px,transparent 1px)`,
                      backgroundSize:`${GRID}px ${GRID}px`,
                      boxShadow:'4px 4px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    {/* Bagua */}
                    {showBagua&&[0,1,2].flatMap(row=>[0,1,2].map(col=>{
                      const sa=SCREEN_ANGLES[row][col]
                      const zoneKey=(col===1&&row===1)?'C':COMPASS_ZONES[Math.round((((northAngle+sa)%360)+360)%360/45)%8]
                      const label=t.zones[zoneKey]
                      return (
                        <div key={`${col}-${row}`} style={{position:'absolute',left:`${col*33.33}%`,top:`${row*33.33}%`,width:'33.33%',height:'33.33%',border:'1px dashed rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                          <span style={{fontSize:8,color:'rgba(255,255,255,0.2)',fontWeight:700,textAlign:'center',lineHeight:1.4,whiteSpace:'pre-line',fontFamily:'monospace'}}>{label.replace('·','\n')}</span>
                        </div>
                      )
                    }))}

                    {/* Furniture items */}
                    {items.map(it=>{
                      const isSel=selectedId===it.id
                      const light=!isDark(it.color)
                      return (
                        <div key={it.id}
                          onMouseDown={e=>itemMouseDown(e,it.id)}
                          onDoubleClick={e=>triggerColor(e,it.id)}
                          onClick={e=>e.stopPropagation()}
                          onMouseMove={e=>{ if(drag.current) return; e.currentTarget.style.cursor=CURSORS[getCorner(e,e.currentTarget)] }}
                          style={{
                            position:'absolute',left:it.x,top:it.y,width:it.w,height:it.h,
                            background:it.color,
                            border:`2px solid ${isSel?'#FFE134':'rgba(0,0,0,0.3)'}`,
                            boxShadow:isSel?`0 0 0 1px #FFE134, 3px 3px 0 rgba(0,0,0,0.25)`:`2px 2px 0 rgba(0,0,0,0.2)`,
                            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                            zIndex:isSel?50:1,userSelect:'none',borderRadius:0,
                            transform:`rotate(${it.rotation||0}deg)`,transformOrigin:'center center',
                            outline:isSel?'1px dashed #FFE134':'none',outlineOffset:isSel?'2px':'0',
                          }}
                        >
                          {isSel&&['nw','ne','sw','se'].map(c=>(
                            <div key={c} style={{position:'absolute',width:6,height:6,background:'#FFE134',pointerEvents:'none',
                              top:c.includes('n')?-2:'auto',bottom:c.includes('s')?-2:'auto',
                              left:c.includes('w')?-2:'auto',right:c.includes('e')?-2:'auto',
                            }}/>
                          ))}
                          {it.type==='custom'
                            ? <span style={{fontSize:it.w>44?14:10,lineHeight:1,userSelect:'none'}}>{it.emoji}</span>
                            : <img src={`/icons/${it.type}.svg`} style={{width:it.w>44?18:12,height:it.w>44?18:12,objectFit:'contain',pointerEvents:'none',userSelect:'none',filter:light?'none':'invert(1)'}} alt=""/>
                          }
                          {it.w>32&&it.h>26&&(
                            <span style={{fontSize:9,color:light?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.9)',fontWeight:700,fontFamily:'monospace',marginTop:2,letterSpacing:'0.3px',userSelect:'none'}}>{it.customLabel||t.furniture[it.type]}</span>
                          )}
                        </div>
                      )
                    })}

                    {/* Color swatch picker */}
                    {colorPickId && colorSwatchPos && (
                      <div onClick={e=>e.stopPropagation()}
                        style={{position:'absolute',left:colorSwatchPos.x,top:colorSwatchPos.y,background:'#000000',border:'2px solid #FF2D78',padding:6,display:'flex',flexWrap:'wrap',gap:3,width:163,zIndex:200,boxShadow:'4px 4px 0 rgba(255,45,120,0.35)'}}>
                        {COLOR_PALETTE.map(col=>{
                          const active = items.find(i=>i.id===colorPickId)?.color === col
                          return (
                            <div key={col} onClick={()=>applyColor(col)}
                              style={{width:26,height:26,background:col,cursor:'pointer',flexShrink:0,border:`2px solid ${active?'#FFE134':'rgba(255,255,255,0.15)'}`,boxShadow:active?'0 0 0 1px #FFE134':'none',transition:'transform 0.1s'}}
                              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.18)'}
                              onMouseLeave={e=>e.currentTarget.style.transform='none'}
                            />
                          )
                        })}
                      </div>
                    )}

                    {/* Floating action buttons */}
                    {selectedId && movingId !== selectedId && !colorPickId && (()=>{
                      const it=items.find(i=>i.id===selectedId); if(!it) return null
                      const above = it.y >= 32
                      const top   = above ? it.y - 30 : it.y + it.h + 4
                      const left  = it.x + it.w/2
                      const floatWrap = {position:'absolute',left,top,transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:3,zIndex:100}
                      const btnBase   = {fontFamily:'monospace',fontSize:11,fontWeight:700,cursor:'pointer',borderRadius:0,whiteSpace:'nowrap',transition:'opacity 0.15s',opacity:0.5}

                      if (confirmDeleteId === selectedId) {
                        return (
                          <div style={{...floatWrap,background:'#000000',border:'2px solid #FF2D78',padding:'4px 8px',gap:6,boxShadow:'3px 3px 0 rgba(255,45,120,0.3)'}}
                            onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
                            <span style={{fontSize:11,fontWeight:700,fontFamily:'monospace',color:'#FFF0CC'}}>{lang==='en'?'Delete?':'确认删除？'}</span>
                            <button style={{...btnBase,padding:'2px 7px',border:'2px solid #FF5C5C',background:'#FF5C5C',color:'#FFF',opacity:1}}
                              onMouseEnter={e=>e.currentTarget.style.opacity='0.75'}
                              onMouseLeave={e=>e.currentTarget.style.opacity='1'}
                              onClick={()=>{setItems(p=>p.filter(i=>i.id!==selectedId));setSelectedId(null);setConfirmDeleteId(null)}}>
                              {lang==='en'?'Yes':'是'}
                            </button>
                            <button style={{...btnBase,padding:'2px 7px',border:'2px solid rgba(255,255,255,0.3)',background:'transparent',color:'#FFF0CC',opacity:1}}
                              onMouseEnter={e=>e.currentTarget.style.opacity='0.5'}
                              onMouseLeave={e=>e.currentTarget.style.opacity='1'}
                              onClick={()=>setConfirmDeleteId(null)}>
                              {lang==='en'?'No':'否'}
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div style={floatWrap} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
                          <button
                            style={{...btnBase,padding:'3px 8px',border:'2px solid #2ECFBD',background:'transparent',color:'#2ECFBD'}}
                            onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                            onMouseLeave={e=>e.currentTarget.style.opacity='0.5'}
                            onMouseDown={e=>{
                              e.preventDefault()
                              if (!roomRef.current) return
                              const r = roomRef.current.getBoundingClientRect()
                              drag.current = {mode:'rotate', id:selectedId, cx:r.left+it.x+it.w/2, cy:r.top+it.y+it.h/2}
                              setMovingId(selectedId)
                            }}>↻</button>
                          <button
                            style={{...btnBase,padding:'3px 8px',border:'2px solid #FF5C5C',background:'transparent',color:'#FF5C5C'}}
                            onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                            onMouseLeave={e=>e.currentTarget.style.opacity='0.5'}
                            onClick={()=>setConfirmDeleteId(selectedId)}>✕</button>
                        </div>
                      )
                    })()}

                  </div>

                  {/* Room resize handles */}
                  <div onMouseDown={e=>roomEdgeDown(e,'room-e')} style={{position:'absolute',right:-9,top:'35%',width:7,height:28,background:'rgba(255,255,255,0.5)',cursor:'ew-resize',zIndex:20}}/>
                  <div onMouseDown={e=>roomEdgeDown(e,'room-s')} style={{position:'absolute',bottom:-9,left:'35%',width:28,height:7,background:'rgba(255,255,255,0.5)',cursor:'ns-resize',zIndex:20}}/>
                  <div onMouseDown={e=>roomEdgeDown(e,'room-se')} style={{position:'absolute',right:-9,bottom:-9,width:11,height:11,background:'rgba(255,255,255,0.8)',cursor:'nwse-resize',zIndex:21}}/>
                </div>
              </div>

            </div>

            <p style={{marginTop:10,fontSize:10,color:'#7777A0',fontWeight:700,letterSpacing:'0.3px',fontFamily:'monospace'}}>
              {t.hint}
            </p>
          </div>
        </div>

        {/* ── Drag divider (desktop only) ── */}
        {!isMobile&&(
          <div onMouseDown={onSplitMouseDown}
            style={{width:2,flexShrink:0,background:'rgba(255,255,255,0.2)',cursor:'ew-resize',userSelect:'none',zIndex:10,transition:'background 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.6)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'}
          />
        )}

        {/* ── Chat panel ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:isMobile?260:0,minWidth:isMobile?0:MIN_PANEL,background:'#0D0D0D',overflow:'hidden'}}>

          <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:10}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:'flex',flexDirection:msg.role==='user'?'row-reverse':'row',gap:8,alignItems:'flex-start'}}>
                {msg.role==='assistant'&&(
                  <div style={{width:28,height:28,border:'2px solid #FF2D78',background:'#FF2D78',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <img src="/logo.svg" style={{width:17,height:17,objectFit:'contain',filter:'invert(1)'}} alt=""/>
                  </div>
                )}
                <div style={{maxWidth:'75%',display:'flex',flexDirection:'column',alignItems:msg.role==='user'?'flex-end':'flex-start',gap:4}}>
                  <div style={{
                    padding:'10px 14px',
                    border:`2px solid ${msg.role==='user'?'#FF2D78':'rgba(255,255,255,0.1)'}`,
                    background:msg.role==='user'?'#FF2D78':'#1A1A1A',
                    color:msg.role==='user'?'#FFF':'#FFF0CC',
                    fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',fontFamily:'monospace',borderRadius:0,
                    boxShadow:msg.role==='user'?'-3px 3px 0 rgba(255,45,120,0.25)':'3px 3px 0 rgba(0,0,0,0.3)',
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:28,height:28,border:'2px solid #FF2D78',background:'#FF2D78',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <img src="/logo.svg" style={{width:17,height:17,objectFit:'contain',filter:'invert(1)'}} alt=""/>
                </div>
                <div style={{padding:'10px 14px',border:'2px solid rgba(255,255,255,0.1)',background:'#1A1A1A',display:'flex',gap:5,alignItems:'center'}}>
                  {[0,1,2].map(n=><div key={n} style={{width:6,height:6,background:'#FF2D78',animation:`bounce 1.2s ease-in-out ${n*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Quick prompts */}
          <div style={{padding:'0 20px 8px',display:'flex',gap:6,flexWrap:'wrap'}}>
            {t.quick.map(p=>(
              <button key={p} onClick={()=>sendMessage(p)} disabled={loading}
                style={{padding:'5px 11px',border:'2px solid rgba(255,45,120,0.4)',background:'transparent',color:'#FFF0CC',fontFamily:'monospace',fontSize:11,fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?0.4:1,borderRadius:0,transition:'all 0.1s'}}
                onMouseEnter={e=>{if(!loading){e.currentTarget.style.borderColor='#FF2D78';e.currentTarget.style.background='rgba(255,45,120,0.15)'}}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='rgba(255,45,120,0.4)'}}
              >{p}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{padding:'6px 20px 14px',display:'flex',gap:8,borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            <input value={inputValue} onChange={e=>setInputValue(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
              placeholder={t.placeholder}
              style={{flex:1,padding:'10px 14px',border:'2px solid rgba(255,45,120,0.4)',background:'#1A1A1A',fontSize:13,color:'#FFF0CC',outline:'none',fontFamily:'monospace',borderRadius:0}}
            />
            <button onClick={()=>sendMessage()} disabled={loading||!inputValue.trim()}
              style={{padding:'10px 20px',border:'2px solid #FF2D78',background:(loading||!inputValue.trim())?'rgba(255,45,120,0.15)':'#FF2D78',color:(loading||!inputValue.trim())?'rgba(255,240,204,0.4)':'#FFF',fontFamily:'monospace',fontSize:13,fontWeight:700,cursor:(loading||!inputValue.trim())?'not-allowed':'pointer',borderRadius:0,whiteSpace:'nowrap',transition:'all 0.15s'}}
            >{loading?'…':t.sendBtn}</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Mini components ──────────────────────────────────────────────────────────

function Btn({ children, active, disabled, onClick }) {
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{
        padding:'5px 12px',
        border:`2px solid ${active?'#FFE134':'rgba(255,255,255,0.2)'}`,
        fontFamily:'monospace',fontSize:12,fontWeight:700,
        cursor:disabled?'not-allowed':'pointer',borderRadius:0,transition:'all 0.1s',
        background: active?'#FFE134':'transparent',
        color: active?'#111111':'#FFF0CC',
        opacity:disabled?0.4:1,
        letterSpacing:'0.3px',
      }}
    >{children}</button>
  )
}

function Sep() {
  return <div style={{width:1,height:20,background:'rgba(255,45,120,0.35)',flexShrink:0}}/>
}
