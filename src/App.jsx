import { useState, useRef, useCallback, useEffect } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_ROOM_W = 240, MIN_ROOM_H = 160, MAX_ROOM_W = 640, MAX_ROOM_H = 480
const MIN_W = 18, MIN_H = 18
const CORNER_HIT = 14
const GRID = 16
const PX_PER_CM = 1
const MIN_PANEL = 300
const WALL_T = 14

const COLOR_PALETTE = [
  '#FF2D78','#FF5C5C','#FF8C33','#FFE134','#C8EC28','#3DD68C',
  '#2ECFBD','#38D5F0','#5B8EFF','#9B5DE5','#E8A0FF','#FFF0CC','#111111',
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
  { type:'door',     emoji:'🚪', w:48, h:WALL_T+2, color:'#FF5C5C', isWall:true  },
  { type:'window',   emoji:'🪟', w:58, h:WALL_T+2, color:'#2ECFBD', isWall:true  },
  { type:'iwall',    emoji:'',   w:120,h:WALL_T,    color:'#555555', isWall:false },
]

const SCREEN_ANGLES = [[315,0,45],[270,null,90],[225,180,135]]
const COMPASS_ZONES  = ['N','NE','E','SE','S','SW','W','NW']

const getZone = (xP, yP, na=0) => {
  const col=xP<33?0:xP<67?1:2, row=yP<33?0:yP<67?1:2
  if (col===1&&row===1) return 'C'
  const sa=SCREEN_ANGLES[row][col]
  return COMPASS_ZONES[Math.round((((na+sa)%360)+360)%360/45)%8]
}

const snapToWall = (item, x, y, rW, rH, iwalls=[]) => {
  const cx = x+item.w/2, cy = y+item.h/2
  // For left/right walls the item is rotated 90°: visual w↔h swap.
  // x: center item in wall thickness. y: constrain by visual height (item.w).
  const leftX  = -WALL_T + item.h/2 - item.w/2
  const rightX = rW + item.h/2 - item.w/2
  const yMinV  = item.w/2 - item.h/2
  const yMaxV  = rH - item.w/2 - item.h/2
  const yV     = Math.max(yMinV, Math.min(yMaxV, y))
  const candidates = [
    { d:cy,    snap:{ x:Math.max(0,Math.min(rW-item.w,x)), y:-WALL_T, rotation:0  } },
    { d:rH-cy, snap:{ x:Math.max(0,Math.min(rW-item.w,x)), y:rH,     rotation:0  } },
    { d:cx,    snap:{ x:leftX,  y:yV, rotation:90 } },
    { d:rW-cx, snap:{ x:rightX, y:yV, rotation:90 } },
    ...iwalls.map(iw=>{
      const isVertIwall = iw.h > iw.w
      const θ = isVertIwall ? Math.PI/2 : ((iw.rotation||0)*Math.PI)/180
      const cosθ=Math.cos(θ), sinθ=Math.sin(θ)
      const wcx=iw.x+iw.w/2, wcy=iw.y+iw.h/2
      const vx=cx-wcx, vy=cy-wcy
      const along = vx*cosθ+vy*sinθ
      const perp  = Math.abs(-vx*sinθ+vy*cosθ)
      const wallLen = isVertIwall ? iw.h : iw.w
      const wallOffset = Math.max(0, Math.min(wallLen-item.w, along+wallLen/2-item.w/2))
      return { d:perp, snap:{ x:iw.x, y:iw.y, wallId:iw.id, wallOffset, rotation:0 } }
    }),
  ]
  const res = candidates.sort((a,b)=>a.d-b.d)[0].snap
  if (!res.wallId) { delete res.wallId; delete res.wallOffset }
  return res
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
    initMsg: 'Hey, I\'m GEOM.\n\nSet up your bedroom layout above, then tell me what\'s on your mind.\n\nDouble-click any furniture to change its colour.',
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
    furniture: { bed:'Bed', desk:'Desk', wardrobe:'Wardrobe', sofa:'Sofa', plant:'Plant', lamp:'Lamp', mirror:'Mirror', crystal:'Crystal', door:'Door', window:'Window', iwall:'Wall' },
    saveBtn: 'Save',
    renewBtn: 'Renew',
    layoutSaved: (isRenew) => isRenew ? 'Layout updated. I have synced your latest room.' : 'Layout saved. Ask me anything about your room.',
    sysPrompt: (room, birth) => `You are GEOM, a stylish cyber feng shui intelligence. Always refer to yourself as GEOM.${room ? ` Room layout: ${room}.` : ''} User birth year: ${birth||'not provided'}. Reply in English, under 200 words, with 1-2 actionable tips. Confident, a little mystical. Do not use emojis, asterisks, quotation marks, or dashes.`,
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
    initMsg: '嗨，我是 GEOM。\n\n先把卧室布置好，然后告诉我你的困惑。\n\n双击家具可以换颜色。',
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
    furniture: { bed:'床', desk:'书桌', wardrobe:'衣柜', sofa:'沙发', plant:'绿植', lamp:'灯', mirror:'镜子', crystal:'水晶', door:'门', window:'窗', iwall:'墙' },
    saveBtn: '保存布局',
    renewBtn: '更新布局',
    layoutSaved: (isRenew) => isRenew ? '布局已更新，我已同步你的最新房间信息。' : '布局已保存，现在可以问我关于房间的问题了。',
    sysPrompt: (room, birth) => `你是GEOM，一个赛博风水智能，始终自称GEOM。${room ? `当前房间：${room}。` : ''}用户出生年份：${birth||'未提供'}。回复200字以内，给1-2个可操作建议，风格自信神秘有个性。不要使用emoji、星号、引号或破折号。`,
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

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const [colorPickId,    setColorPickId]    = useState(null)
  const [colorSwatchPos, setColorSwatchPos] = useState(null)

  const [items, setItems] = useState([
    { id:'1', type:'bed',      emoji:'🛏', x:28,  y:52,  w:88, h:64, color:'#FF2D78', isWall:false, rotation:0 },
    { id:'2', type:'desk',     emoji:'🖥', x:270, y:28,  w:76, h:52, color:'#5B8EFF', isWall:false, rotation:0 },
    { id:'3', type:'plant',    emoji:'🌿', x:370, y:244, w:36, h:36, color:'#3DD68C', isWall:false, rotation:0 },
    { id:'4', type:'wardrobe', emoji:'🗄', x:28,  y:228, w:52, h:84, color:'#9B5DE5', isWall:false, rotation:0 },
    { id:'5', type:'door',   emoji:'🚪', x:162, y:-WALL_T, w:48, h:WALL_T+2, color:'#FF5C5C', isWall:true, rotation:0 },
    { id:'6', type:'window', emoji:'🪟', x:290, y:340,    w:58, h:WALL_T+2, color:'#2ECFBD', isWall:true, rotation:0 },
  ])

  const drag               = useRef(null)
  const roomRef            = useRef(null)
  const splitContainerRef  = useRef(null)
  const chatEndRef         = useRef(null)
  const dragFurnitureType  = useRef(null)
  const [roomDragOver, setRoomDragOver] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [movingId,        setMovingId]        = useState(null)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customForm,      setCustomForm]      = useState({ name:'', w:60, h:60 })

  const [savedLayout, setSavedLayout] = useState(null)

  const [birthYear,  setBirthYear]  = useState('')
  const [editingDim, setEditingDim] = useState(null)
  const [dimInput,   setDimInput]   = useState('')
  const [inputValue, setInputValue] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [messages,   setMessages]   = useState([{ role:'assistant', content: T.en.initMsg }])
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
    const wall = it.wallId ? items.find(w=>w.id===it.wallId) : null
    drag.current = {
      mode: corner==='move' ? 'move' : `resize-${corner}`,
      id, sx:e.clientX, sy:e.clientY,
      orig:{ x:it.x, y:it.y, w:it.w, h:it.h, roomW, roomH,
             wallOffset:it.wallOffset, wallId:it.wallId },
      ...(wall && { wallRotation:wall.rotation||0, wallW:wall.w }),
    }
  }

  const onMouseMove = useCallback((e) => {
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
    if (d.mode==='move') {
      setItems(prev=>prev.map(it=>{
        if (it.id!==d.id) return it
        if (it.wallId) {
          const wall = prev.find(w=>w.id===it.wallId)
          if (!wall) return it
          const isVertWall = wall.h > wall.w
          // Absolute room position based on original wallOffset
          const absX = isVertWall ? wall.x : wall.x + (d.orig.wallOffset||0)
          const absY = isVertWall ? wall.y + (d.orig.wallOffset||0) : wall.y
          // Re-snap to nearest wall (any iwall or outer wall)
          const iwalls = prev.filter(i=>i.type==='iwall')
          const snapped = snapToWall(it, absX+dx, absY+dy, d.orig.roomW, d.orig.roomH, iwalls)
          return {...it, wallId:undefined, wallOffset:undefined, ...snapped}
        }
        if (it.isWall) {
          const nx = d.orig.x+dx, ny = d.orig.y+dy
          const iwalls = prev.filter(i=>i.type==='iwall')
          return {...it, ...snapToWall(it, nx+WALL_T, ny+WALL_T, d.orig.roomW, d.orig.roomH, iwalls)}
        }
        return {...it, x:clamp(d.orig.x+dx,0,d.orig.roomW-it.w), y:clamp(d.orig.y+dy,0,d.orig.roomH-it.h)}
      }))
    }
    else if (d.mode.startsWith('resize-')) {
      const corner = d.mode.slice(7)
      setItems(prev=>prev.map(it=>{
        if (it.id!==d.id) return it
        if (it.wallId) {
          // resize along parent wall axis (width only)
          const wall = prev.find(w=>w.id===it.wallId)
          if (!wall) return it
          const isVertWall = wall.h > wall.w
          const dAlong = isVertWall ? dy : dx
          const wallLen = isVertWall ? wall.h : wall.w
          let { w, wallOffset } = d.orig
          if (corner==='se'||corner==='sw') { w=Math.max(MIN_W, w+dAlong) }
          else { const nw=Math.max(MIN_W,w-dAlong); wallOffset=wallOffset+w-nw; w=nw }
          wallOffset=Math.max(0,Math.min(wallLen-w,wallOffset))
          return {...it, w, wallOffset}
        }
        let { x,y,w,h } = d.orig
        const lockH = it.isWall || (it.type==='iwall' && d.orig.w>=d.orig.h)
        const lockW = it.type==='iwall' && d.orig.w<d.orig.h
        if (corner==='se') { if(!lockW) w=Math.max(MIN_W,w+dx); if(!lockH) h=Math.max(MIN_H,h+dy) }
        if (corner==='sw') { if(!lockW){const nw=Math.max(MIN_W,w-dx); x=x+w-nw; w=nw}; if(!lockH) h=Math.max(MIN_H,h+dy) }
        if (corner==='ne') { if(!lockW) w=Math.max(MIN_W,w+dx); if(!lockH){const nh=Math.max(MIN_H,h-dy);y=y+h-nh;h=nh} }
        if (corner==='nw') { if(!lockW){const nw=Math.max(MIN_W,w-dx);x=x+w-nw;w=nw}; if(!lockH){const nh=Math.max(MIN_H,h-dy);y=y+h-nh;h=nh} }
        if (!it.isWall) { x=clamp(x,0,d.orig.roomW-MIN_W); y=clamp(y,0,d.orig.roomH-MIN_H) }
        w=Math.min(w, it.isWall ? d.orig.roomW : d.orig.roomW-x)
        if (!lockH) h=Math.min(h,d.orig.roomH-y)
        return {...it,x,y,w,h}
      }))
    }
  }, [])

  const onMouseUp = useCallback(()=>{
    drag.current = null
    setMovingId(null)
  },[])

  useEffect(()=>{
    window.addEventListener('mousemove',onMouseMove)
    window.addEventListener('mouseup',onMouseUp)
    return ()=>{ window.removeEventListener('mousemove',onMouseMove); window.removeEventListener('mouseup',onMouseUp) }
  },[onMouseMove,onMouseUp])

  useEffect(()=>{
    setItems(p=>p.map(it=>{
      if (it.isWall) return it  // wall items keep their negative coords; re-snap on next drag
      if (it.type==='iwall') {
        const isHoriz = it.w >= it.h
        if (isHoriz) return {...it, w:roomW, x:0}
        else return {...it, h:roomH, y:0, x:clamp(it.x,0,roomW-it.w)}
      }
      return {...it, x:clamp(it.x,0,roomW-it.w), y:clamp(it.y,0,roomH-it.h)}
    }))
  },[roomW,roomH])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clamp = (v,lo,hi)=>Math.min(hi,Math.max(lo,v))

  const addItem = type => {
    const f = FURNITURE.find(f=>f.type===type)
    const sx = f.isWall ? roomW/2-f.w/2 : 80+Math.random()*100
    const sy = f.isWall ? 0 : 60+Math.random()*80
    const pos = f.isWall ? snapToWall(f,sx,sy,roomW,roomH) : {x:sx,y:sy}
    setItems(p=>[...p,{id:Date.now().toString(),...f,rotation:0,...pos}])
  }

  const compassDirAt = off => t.compass[Math.round(((northAngle+off)+360)%360/45)%8]

  const describeRoom = () =>
    `top=${compassDirAt(0)}, ${toCm(roomW)}×${toCm(roomH)}cm, ` +
    items.map(it=>{
      const xP=((it.x+it.w/2)/roomW)*100, yP=((it.y+it.h/2)/roomH)*100
      return `${it.customLabel||t.furniture[it.type]}→${t.zones[getZone(xP,yP,northAngle)]}`
    }).join(', ')

  // ── API ──────────────────────────────────────────────────────────────────

  const saveLayout = () => {
    const isRenew = savedLayout !== null
    const layout = describeRoom()
    setSavedLayout(layout)
    const notice = t.layoutSaved(isRenew)
    push('assistant', notice)
    setApiHistory(prev => [
      ...prev,
      { role: 'user', content: `[Room layout ${isRenew ? 'updated' : 'saved'}: ${layout}]` },
      { role: 'assistant', content: notice },
    ])
  }

  const sendMessage = async txt => {
    const msg=(txt||inputValue).trim(); if(!msg||loading) return
    setInputValue('')
    push('user',msg)
    setLoading(true)
    const hist=[...apiHistory,{role:'user',content:msg}]
    try {
      const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:t.sysPrompt(savedLayout,birthYear),messages:hist})})
      const d=await r.json()
      const reply=cleanReply(d.content?.[0]?.text||d.error?.message||t.errCrystal)
      push('assistant',reply)
      setApiHistory([...hist,{role:'assistant',content:reply}])
    } catch { push('assistant',t.errConn) }
    finally { setLoading(false) }
  }

  const push = (role, content) => setMessages(p=>[...p,{role,content}])

  const cleanReply = text =>
    text
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[*“”‘’「」『』—–]/g, '')
      .replace(/ {2,}/g, ' ')
      .trim()

  const addCustomItem = () => {
    if (!customForm.name.trim()) return
    const w = Math.max(18, Math.min(200, customForm.w))
    const h = Math.max(18, Math.min(200, customForm.h))
    setItems(p=>[...p, {
      id: Date.now().toString(), type:'custom',
      customLabel: customForm.name.trim(),
      x: clamp(80+Math.random()*80, 0, roomW-w),
      y: clamp(60+Math.random()*80, 0, roomH-h),
      w, h, color:'#FF2D78', isWall:false, rotation:0,
    }])
    setShowCustomModal(false)
    setCustomForm({ name:'', w:60, h:60 })
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
        style={{cursor:'grab',display:'block',flexShrink:0,filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.18))'}}
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
        <rect x={2} y={2} width={R*2} height={R*2} rx={6} fill="#111" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5}/>
        {[0,45,90,135,180,225,270,315].map(deg=>{
          const r=(deg-northAngle)*Math.PI/180, long=deg%90===0
          const [x1,y1]=pt(r,long?R-7:R-4), [x2,y2]=pt(r,R-2)
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={long?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.2)'} strokeWidth={long?1.5:1}/>
        })}
        <polygon points={`${pt(-rad,19)} ${pt(-rad+2.65,5)} ${pt(-rad-2.65,5)}`} fill="#FF2D78"/>
        <polygon points={`${pt(-rad+Math.PI,19)} ${pt(-rad+2.65,5)} ${pt(-rad-2.65,5)}`} fill="#fff"/>
        <text x={pt(-rad,13)[0]} y={pt(-rad,13)[1]+3.5} textAnchor="middle" fontSize={7} fontWeight="700" fill="#FFE134" fontFamily="monospace">{t.compass[0]}</text>
        <rect x={R-2} y={R-2} width={8} height={8} rx={2} fill="#111" stroke="rgba(255,255,255,0.2)" strokeWidth={1}/>
      </svg>
    )
  }

  const CURSORS = {nw:'nw-resize',ne:'ne-resize',sw:'sw-resize',se:'se-resize',move:'grab'}
  const floorIsDark = isDark(floorColor)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height:'100vh', background:'#000',
      padding: 0,
      display:'flex', flexDirection:'column', gap:'1px',
      boxSizing:'border-box', overflow:'hidden',
    }}>

      {/* ── Custom furniture modal ── */}
      {showCustomModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setShowCustomModal(false)}>
          <div style={{background:'#fff',borderRadius:22,padding:28,width:340,fontFamily:'inherit',boxShadow:'0 24px 64px rgba(0,0,0,0.3)'}}
            onClick={e=>e.stopPropagation()}>
            <h2 style={{margin:'0 0 20px',fontSize:16,fontWeight:700,color:'#111'}}>{t.customTitle}</h2>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:'#999',letterSpacing:'1.5px',marginBottom:6,textTransform:'uppercase'}}>{t.nameLabel}</div>
              <input value={customForm.name} onChange={e=>setCustomForm(f=>({...f,name:e.target.value}))}
                placeholder={t.namePlaceholder} maxLength={12}
                onKeyDown={e=>e.key==='Enter'&&addCustomItem()}
                style={{width:'100%',padding:'10px 14px',border:'1.5px solid #eee',background:'#fff',color:'#111',fontFamily:'inherit',fontSize:13,outline:'none',borderRadius:10,boxSizing:'border-box'}}/>
            </div>

            <div style={{marginBottom:24,display:'flex',gap:10}}>
              {[['w',t.wLabel],['h',t.hLabel]].map(([k,lbl])=>(
                <div key={k} style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#999',letterSpacing:'1.5px',marginBottom:6,textTransform:'uppercase'}}>{lbl} (px)</div>
                  <input type="number" value={customForm[k]} min={18} max={200}
                    onChange={e=>setCustomForm(f=>({...f,[k]:Math.max(18,Math.min(200,+e.target.value||18))}))}
                    style={{width:'100%',padding:'10px 14px',border:'1.5px solid #eee',background:'#fff',color:'#111',fontFamily:'inherit',fontSize:13,outline:'none',borderRadius:10,boxSizing:'border-box'}}/>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowCustomModal(false)}
                style={{padding:'10px 20px',border:'1.5px solid #eee',background:'transparent',color:'#111',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer',borderRadius:999}}>
                {t.cancelBtn}
              </button>
              <button onClick={addCustomItem} disabled={!customForm.name.trim()}
                style={{padding:'10px 20px',border:'none',background:customForm.name.trim()?'#111':'#eee',color:customForm.name.trim()?'#fff':'#aaa',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:customForm.name.trim()?'pointer':'not-allowed',borderRadius:999,transition:'all 0.15s'}}>
                {t.addBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top row: header + birth year + lang ── */}
      <div style={{display:'flex',gap:'1px',flexShrink:0}}>
        {/* Header Card */}
        <div style={{background:'#fff',borderRadius:14,padding:'6px 22px',display:'flex',alignItems:'center',gap:10,flex:1}}>
          <img src="/logo.svg" style={{width:22,height:22,objectFit:'contain',flexShrink:0}} alt="GEOM"/>
          <div>
            <h1 style={{fontSize:15,fontWeight:700,color:'#111',letterSpacing:'-0.5px',margin:0}}>{t.appName}</h1>
            <p style={{fontSize:7,color:'#aaa',letterSpacing:'2px',margin:0,fontWeight:600,textTransform:'uppercase'}}>{t.appSub}</p>
          </div>
        </div>

        {/* Birth Year Card */}
        <div style={{background:'#fff',borderRadius:14,padding:'6px 16px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontSize:11,color:'#888',fontWeight:600,whiteSpace:'nowrap'}}>{t.birthYear}</span>
          <input type="number" value={birthYear} onChange={e=>setBirthYear(e.target.value)} placeholder="2000"
            style={{width:68,padding:'4px 10px',border:'1.5px solid #eee',background:'#fff',fontSize:12,color:'#111',outline:'none',borderRadius:999,fontFamily:'inherit'}}/>
        </div>

        {/* Lang Card */}
        <button onClick={()=>setLang(l=>l==='en'?'zh':'en')}
          style={{background:'#fff',borderRadius:14,padding:'6px 20px',border:'none',color:'#111',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0,textTransform:'uppercase',letterSpacing:'0.5px',transition:'background 0.1s,color 0.1s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='#C8EC28';e.currentTarget.style.color='#111'}}
          onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#111'}}
        >{t.langBtn}</button>
      </div>

      {/* ── Main Bento Grid ── */}
      <div ref={splitContainerRef} style={{
        flex:1, minHeight:0,
        display: isMobile ? 'flex' : 'grid',
        flexDirection: isMobile ? 'column' : undefined,
        gridTemplateColumns: '116px 1fr 330px',
        gap:'1px',
      }}>

        {/* ── Palette Card ── */}
        <div style={{background:'#fff',borderRadius:14,padding:'16px 12px',display:'flex',flexDirection:'column',gap:4,overflowY:'auto',flexShrink:0}}>
          <div style={{fontSize:9,fontWeight:700,color:'#bbb',letterSpacing:'2px',marginBottom:8,textTransform:'uppercase',textAlign:'center'}}>{t.add}</div>
          {FURNITURE.map(f=>(
            <div key={f.type}
              draggable
              onDragStart={e=>{
                dragFurnitureType.current = f.type
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onDragEnd={()=>{ dragFurnitureType.current=null }}
              style={{padding:'7px 10px',border:'none',background:'#f6f6f6',color:'#111',fontSize:11,fontWeight:600,cursor:'grab',borderRadius:999,textAlign:'left',display:'flex',alignItems:'center',gap:6,transition:'all 0.1s',whiteSpace:'nowrap',userSelect:'none'}}
              onMouseEnter={e=>{e.currentTarget.style.background='#C8EC28';e.currentTarget.style.color='#111'}}
              onMouseLeave={e=>{e.currentTarget.style.background='#f6f6f6';e.currentTarget.style.color='#111'}}
            >
              <span style={{width:7,height:7,borderRadius:'50%',background:f.color,display:'inline-block',flexShrink:0}}/>
              <img src={`/icons/${f.type}.svg`} style={{width:12,height:12,objectFit:'contain',flexShrink:0}} alt=""/>
              <span>{t.furniture[f.type]}</span>
            </div>
          ))}
          <button onClick={()=>setShowCustomModal(true)}
            style={{padding:'7px 10px',border:'1.5px dashed #ddd',background:'transparent',color:'#aaa',fontSize:11,fontWeight:600,cursor:'pointer',borderRadius:999,textAlign:'left',display:'flex',alignItems:'center',gap:6,marginTop:6,transition:'all 0.1s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#111';e.currentTarget.style.color='#111'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#ddd';e.currentTarget.style.color='#aaa'}}
          >
            <span style={{fontSize:13}}>✚</span>
            <span>{t.customBtn}</span>
          </button>
        </div>

        {/* ── Middle column ── */}
        <div style={{display:'flex',flexDirection:'column',gap:'1px',minHeight:0}}>

        {/* ── Toolbar Card ── */}
        <div style={{background:'#fff',borderRadius:14,padding:'10px 18px',display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
          {/* Toolbar row 1 */}
          <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
            <PillBtn active={true}>{t.tabRoom}</PillBtn>
            <VSep/>
            <span style={{fontSize:10,color:'#aaa',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>{t.unit}</span>
            {['cm','inch'].map(u=>(
              <PillBtn key={u} active={unit===u} onClick={()=>setUnit(u)}>{u==='cm'?'CM':'IN'}</PillBtn>
            ))}
            <VSep/>
            <PillBtn active={showBagua} onClick={()=>setShowBagua(v=>!v)}>{t.bagua}</PillBtn>
          </div>

          {/* Floor row */}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:10,color:'#aaa',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>{t.floor}</span>
            <div style={{display:'flex',gap:5}}>
              {[{col:'#F5F5F5',label:'White'},{col:'#888888',label:'Grey'},{col:'#111111',label:'Black'}].map(({col,label})=>(
                <div key={col} onClick={()=>setFloorColor(col)} title={label}
                  style={{width:20,height:20,background:col,cursor:'pointer',flexShrink:0,borderRadius:'50%',border:`2.5px solid ${floorColor===col?'#111':'transparent'}`,outline:'1.5px solid #eee',transition:'transform 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Canvas Card ── */}
        <div style={{background:'#fff',borderRadius:14,padding:'18px 20px',overflow:'auto',display:'flex',flexDirection:'column',gap:10,flex:1,minHeight:0}}>
          {/* Compass + size row */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <Compass/>
            <span style={{fontSize:11,color:'#aaa',fontWeight:500,fontFamily:'monospace'}}>
              {(()=>{ const it=items.find(i=>i.id===selectedId); return it ? `${fmtUnit(it.w,unit)} × ${fmtUnit(it.h,unit)}` : `${fmtUnit(roomW,unit)} × ${fmtUnit(roomH,unit)}` })()}
            </span>
          </div>
          {/* Canvas */}
          <div style={{flex:1,display:'flex',justifyContent:'center',alignItems:'flex-start',overflow:'auto'}}>
            <div style={{position:'relative',padding:`${WALL_T+30}px ${WALL_T+30}px`}}>
              {/* Direction labels */}
              {[
                {lbl:compassDirAt(0),   s:{top:8,           left:'50%',transform:'translateX(-50%)'}},
                {lbl:compassDirAt(180), s:{bottom:8,         left:'50%',transform:'translateX(-50%)'}},
                {lbl:compassDirAt(270), s:{top:'50%',        left:8,    transform:'translateY(-50%)'}},
                {lbl:compassDirAt(90),  s:{top:'50%',        right:8,   transform:'translateY(-50%)'}},
              ].map(({lbl,s},i)=>(
                <div key={i} style={{position:'absolute',fontSize:10,fontWeight:700,color:'#bbb',whiteSpace:'nowrap',fontFamily:'monospace',...s}}>{lbl}</div>
              ))}

              {/* ── Outer wall shell (double-line effect) ── */}
              <div style={{position:'relative', width:roomW+2*WALL_T, height:roomH+2*WALL_T}}>
                {/* Outer wall line */}
                <div style={{position:'absolute',inset:0,background:'transparent',borderRadius:6,border:'2px solid #333',pointerEvents:'none',zIndex:0}}/>
                {/* Inner wall line */}
                <div style={{position:'absolute',left:WALL_T-1,top:WALL_T-1,width:roomW+2,height:roomH+2,border:'1.5px solid #333',pointerEvents:'none',zIndex:2}}/>

                {/* Dimension labels – double-click to edit */}
                {/* Width (bottom) */}
                <div style={{position:'absolute',bottom:-(WALL_T+16),left:WALL_T,width:roomW,textAlign:'center',cursor:'pointer',zIndex:10}}
                  onDoubleClick={()=>{setEditingDim('w');setDimInput(String(toCm(roomW)))}}>
                  {editingDim==='w'
                    ? <input autoFocus type="number" value={dimInput} onChange={e=>setDimInput(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape'){const v=parseInt(dimInput);if(!isNaN(v)&&v>0)setRoomW(clamp(v,MIN_ROOM_W,MAX_ROOM_W));setEditingDim(null)}}}
                        onBlur={()=>{const v=parseInt(dimInput);if(!isNaN(v)&&v>0)setRoomW(clamp(v,MIN_ROOM_W,MAX_ROOM_W));setEditingDim(null)}}
                        style={{width:70,textAlign:'center',fontSize:10,fontFamily:'monospace',border:'1px solid #ccc',borderRadius:4,padding:'1px 4px',outline:'none'}}/>
                    : <span style={{fontSize:10,color:'#aaa',fontFamily:'monospace',borderBottom:'1px dashed #ddd'}}>{fmtUnit(roomW,unit)}</span>}
                </div>
                {/* Height (right) */}
                <div style={{position:'absolute',right:-(WALL_T+16),top:WALL_T,height:roomH,display:'flex',alignItems:'center',cursor:'pointer',zIndex:10}}
                  onDoubleClick={()=>{setEditingDim('h');setDimInput(String(toCm(roomH)))}}>
                  {editingDim==='h'
                    ? <input autoFocus type="number" value={dimInput} onChange={e=>setDimInput(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape'){const v=parseInt(dimInput);if(!isNaN(v)&&v>0)setRoomH(clamp(v,MIN_ROOM_H,MAX_ROOM_H));setEditingDim(null)}}}
                        onBlur={()=>{const v=parseInt(dimInput);if(!isNaN(v)&&v>0)setRoomH(clamp(v,MIN_ROOM_H,MAX_ROOM_H));setEditingDim(null)}}
                        style={{width:60,textAlign:'center',fontSize:10,fontFamily:'monospace',border:'1px solid #ccc',borderRadius:4,padding:'1px 4px',outline:'none'}}/>
                    : <span style={{fontSize:10,color:'#aaa',fontFamily:'monospace',writingMode:'vertical-rl',transform:'rotate(180deg)',borderLeft:'1px dashed #ddd'}}>{fmtUnit(roomH,unit)}</span>}
                </div>

                {/* Inner floor (roomRef) — overflow:visible so wall items extend into wall zone */}
                <div ref={roomRef}
                  onClick={()=>{setSelectedId(null);setConfirmDeleteId(null);closeColorSwatch()}}
                  onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; setRoomDragOver(true) }}
                  onDragLeave={()=>setRoomDragOver(false)}
                  onDrop={e=>{
                    e.preventDefault()
                    setRoomDragOver(false)
                    const type = dragFurnitureType.current
                    if (!type) return
                    const f = FURNITURE.find(f=>f.type===type)
                    if (!f || !roomRef.current) return
                    const rect = roomRef.current.getBoundingClientRect()
                    const dropX = e.clientX - rect.left
                    const dropY = e.clientY - rect.top
                    let pos
                    if (f.type === 'iwall') {
                      const y = clamp(dropY - WALL_T/2, 0, roomH - WALL_T)
                      pos = { x:0, y, w:roomW, h:WALL_T }
                    } else if (f.isWall) {
                      const iwalls = items.filter(i=>i.type==='iwall')
                      pos = snapToWall(f, dropX - f.w/2, dropY - f.h/2, roomW, roomH, iwalls)
                    } else {
                      pos = { x:clamp(dropX-f.w/2,0,roomW-f.w), y:clamp(dropY-f.h/2,0,roomH-f.h) }
                    }
                    setItems(p=>[...p,{id:Date.now().toString(),...f,rotation:0,...pos}])
                    dragFurnitureType.current = null
                  }}
                  style={{
                    position:'absolute', left:WALL_T, top:WALL_T,
                    width:roomW, height:roomH,
                    background: roomDragOver ? 'rgba(91,142,255,0.06)' : floorColor,
                    outline: roomDragOver ? '2px dashed #5B8EFF' : 'none',
                    overflow:'visible', userSelect:'none',
                    backgroundImage:`linear-gradient(${floorIsDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'} 1px,transparent 1px),linear-gradient(90deg,${floorIsDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'} 1px,transparent 1px)`,
                    backgroundSize:`${GRID}px ${GRID}px`,
                    zIndex:1,
                  }}
                >
                {/* Bagua */}
                {showBagua&&[0,1,2].flatMap(row=>[0,1,2].map(col=>{
                  const sa=SCREEN_ANGLES[row][col]
                  const zoneKey=(col===1&&row===1)?'C':COMPASS_ZONES[Math.round((((northAngle+sa)%360)+360)%360/45)%8]
                  const label=t.zones[zoneKey]
                  return (
                    <div key={`${col}-${row}`} style={{position:'absolute',left:`${col*33.33}%`,top:`${row*33.33}%`,width:'33.33%',height:'33.33%',border:'1px dashed rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                      <span style={{fontSize:8,color:'rgba(0,0,0,0.18)',fontWeight:600,textAlign:'center',lineHeight:1.4,whiteSpace:'pre-line',fontFamily:'monospace'}}>{label.replace('·','\n')}</span>
                    </div>
                  )
                }))}

                {/* Furniture items */}
                {items.map(it=>{
                  if (it.wallId) return null  // rendered inside parent iwall
                  const isSel=selectedId===it.id
                  const isIwall=it.type==='iwall'
                  const isWallItem=it.isWall
                  const light=isWallItem?true:!isDark(it.color)
                  const bg=isIwall?'transparent':isWallItem?floorColor:it.color
                  const corners=(isWallItem||isIwall)?['nw','ne','sw','se'].filter(c=>c.includes('w')||c.includes('e')):['nw','ne','sw','se']
                  const iwallChildren=isIwall?items.filter(ch=>ch.wallId===it.id):[]
                  const renderWallChild=ch=>{
                    const chSel=selectedId===ch.id
                    const isVertIwall=it.h>it.w
                    // For vertical iwalls: ch.w = opening size (now rendered vertically), ch.h = wall thickness
                    const cW=isVertIwall?ch.h:ch.w, cH=isVertIwall?ch.w:ch.h
                    const posStyle=isVertIwall
                      ?{left:-1,top:ch.wallOffset||0,width:cW,height:cH}
                      :{left:ch.wallOffset||0,top:-1,width:cW,height:cH}
                    const resizeCorners=['nw','ne','sw','se'].filter(c=>isVertIwall?(c.includes('n')||c.includes('s')):(c.includes('w')||c.includes('e')))
                    return (
                      <div key={ch.id}
                        onMouseDown={e=>{e.stopPropagation();itemMouseDown(e,ch.id)}}
                        onClick={e=>e.stopPropagation()}
                        style={{position:'absolute',...posStyle,
                          background:floorColor,border:`2px solid ${ch.color}`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          zIndex:chSel?10:2,userSelect:'none',cursor:'grab',
                          outline:chSel?'2px solid #C8EC28':'none',
                        }}>
                        {chSel&&resizeCorners.map(c=>(
                          <div key={c} style={{position:'absolute',width:7,height:7,background:'#111',borderRadius:'50%',pointerEvents:'none',
                            top:c.includes('n')?-3:'auto',bottom:c.includes('s')?-3:'auto',
                            left:c.includes('w')?-3:'auto',right:c.includes('e')?-3:'auto'}}/>
                        ))}
                        {cH>32&&<span style={{fontSize:9,color:ch.color,fontWeight:600,fontFamily:'monospace',userSelect:'none',transform:isVertIwall?'rotate(90deg)':'none'}}>{t.furniture[ch.type]}</span>}
                        {chSel&&(
                          <button onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>{e.stopPropagation();setItems(p=>p.filter(i=>i.id!==ch.id));setSelectedId(null)}}
                            style={{position:'absolute',top:-12,right:-12,width:18,height:18,borderRadius:'50%',background:'rgba(255,59,48,0.9)',color:'#fff',border:'none',cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20}}>✕</button>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div key={it.id}
                      onMouseDown={e=>itemMouseDown(e,it.id)}
                      onDoubleClick={e=>isWallItem||isIwall?null:triggerColor(e,it.id)}
                      onClick={e=>e.stopPropagation()}
                      onMouseMove={e=>{ if(drag.current) return; e.currentTarget.style.cursor=CURSORS[getCorner(e,e.currentTarget)] }}
                      style={{
                        position:'absolute',left:it.x,top:it.y,width:it.w,height:it.h,
                        background:bg,
                        border:isIwall?`1.5px solid ${isSel?'#C8EC28':'#333'}`:isWallItem?`2px solid ${it.color}`:`2px solid ${isSel?'#111':'transparent'}`,
                        borderRadius:isIwall||isWallItem?0:6,
                        boxShadow:isSel&&!isIwall&&!isWallItem?'0 0 0 2px #111, 0 4px 12px rgba(0,0,0,0.15)':'none',
                        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                        zIndex:isWallItem?3:isSel?50:1,
                        userSelect:'none',overflow:'visible',
                        transform:`rotate(${it.rotation||0}deg)`,transformOrigin:'center center',
                        outline:isSel&&(isIwall||isWallItem)?'2px solid #C8EC28':'none',
                      }}
                    >
                      {isSel&&corners.map(c=>(
                        <div key={c} style={{position:'absolute',width:7,height:7,background:'#111',borderRadius:'50%',pointerEvents:'none',
                          top:c.includes('n')?-3:'auto',bottom:c.includes('s')?-3:'auto',
                          left:c.includes('w')?-3:'auto',right:c.includes('e')?-3:'auto'}}/>
                      ))}
                      {!isIwall&&!isWallItem&&it.type!=='custom'&&(
                        <img src={`/icons/${it.type}.svg`} style={{width:it.w>44?18:12,height:it.w>44?18:12,objectFit:'contain',pointerEvents:'none',userSelect:'none',filter:light?'none':'invert(1)'}} alt=""/>
                      )}
                      {!isIwall&&it.w>32&&it.h>10&&(
                        <span style={{fontSize:9,color:isWallItem?it.color:'rgba(0,0,0,0.7)',fontWeight:600,fontFamily:'monospace',userSelect:'none'}}>{it.customLabel||t.furniture[it.type]}</span>
                      )}
                      {iwallChildren.map(ch=>renderWallChild(ch))}
                    </div>
                  )
                })}

                {/* Color swatch picker */}
                {colorPickId && colorSwatchPos && (
                  <div onClick={e=>e.stopPropagation()}
                    style={{position:'absolute',left:colorSwatchPos.x,top:colorSwatchPos.y,background:'#fff',border:'1px solid #eee',borderRadius:14,padding:8,display:'flex',flexWrap:'wrap',gap:4,width:170,zIndex:200,boxShadow:'0 8px 24px rgba(0,0,0,0.12)'}}>
                    {COLOR_PALETTE.map(col=>{
                      const active = items.find(i=>i.id===colorPickId)?.color === col
                      return (
                        <div key={col} onClick={()=>applyColor(col)}
                          style={{width:26,height:26,background:col,cursor:'pointer',flexShrink:0,borderRadius:6,border:`2px solid ${active?'#111':'transparent'}`,boxShadow:'0 0 0 1px rgba(0,0,0,0.08)',transition:'transform 0.1s'}}
                          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
                          onMouseLeave={e=>e.currentTarget.style.transform='none'}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Floating action buttons */}
                {selectedId && movingId !== selectedId && !colorPickId && (()=>{
                  const it=items.find(i=>i.id===selectedId); if(!it||it.wallId) return null
                  const above = it.y >= 32
                  const top   = above ? it.y - 30 : it.y + it.h + 4
                  const left  = it.x + it.w/2
                  const floatWrap = {position:'absolute',left,top,transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:4,zIndex:100}
                  const btnBase   = {fontFamily:'inherit',fontSize:11,fontWeight:600,cursor:'pointer',borderRadius:999,whiteSpace:'nowrap',transition:'all 0.15s',border:'none'}

                  if (confirmDeleteId === selectedId) {
                    return (
                      <div style={{...floatWrap,background:'#fff',border:'1px solid #eee',borderRadius:999,padding:'4px 12px',gap:8,boxShadow:'0 4px 16px rgba(0,0,0,0.12)'}}
                        onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
                        <span style={{fontSize:11,fontWeight:600,color:'#111'}}>{lang==='en'?'Delete?':'确认删除？'}</span>
                        <button style={{...btnBase,padding:'3px 10px',background:'#ff3b30',color:'#fff'}}
                          onClick={()=>{setItems(p=>p.filter(i=>i.id!==selectedId&&i.wallId!==selectedId));setSelectedId(null);setConfirmDeleteId(null)}}>
                          {lang==='en'?'Yes':'是'}
                        </button>
                        <button style={{...btnBase,padding:'3px 10px',background:'#f0f0f0',color:'#111'}}
                          onClick={()=>setConfirmDeleteId(null)}>
                          {lang==='en'?'No':'否'}
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div style={floatWrap} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
                      {!it.isWall&&(
                        <button
                          style={{...btnBase,padding:'4px 10px',background:'rgba(255,255,255,0.92)',color:'#111',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}
                          onMouseDown={e=>{
                            e.preventDefault()
                            if (it.type==='iwall') {
                              setItems(prev=>{
                                const iw=prev.find(i=>i.id===it.id); if(!iw) return prev
                                const cx=iw.x+iw.w/2, cy=iw.y+iw.h/2
                                const isHoriz=iw.w>=iw.h
                                let newIwall
                                if (isHoriz) {
                                  const nw=WALL_T, nh=Math.min(roomH,Math.max(iw.w,40))
                                  newIwall={...iw,w:nw,h:nh,x:clamp(cx-nw/2,0,roomW-nw),y:clamp(cy-nh/2,0,roomH-nh),rotation:0}
                                } else {
                                  const nh=WALL_T, nw=Math.min(roomW,Math.max(iw.h,40))
                                  newIwall={...iw,w:nw,h:nh,x:clamp(cx-nw/2,0,roomW-nw),y:clamp(cy-nh/2,0,roomH-nh),rotation:0}
                                }
                                const oldLen=isHoriz?iw.w:iw.h
                                const newLen=isHoriz?newIwall.h:newIwall.w
                                return prev.map(i=>{
                                  if (i.id===iw.id) return newIwall
                                  if (i.wallId===iw.id) {
                                    const ratio=oldLen>0?(i.wallOffset||0)/oldLen:0
                                    return {...i,wallOffset:clamp(Math.round(ratio*newLen),0,newLen-i.w)}
                                  }
                                  return i
                                })
                              })
                              return
                            }
                            if (!roomRef.current) return
                            const r = roomRef.current.getBoundingClientRect()
                            drag.current = {mode:'rotate', id:selectedId, cx:r.left+it.x+it.w/2, cy:r.top+it.y+it.h/2}
                            setMovingId(selectedId)
                          }}>↻</button>
                      )}
                      <button
                        style={{...btnBase,padding:'4px 10px',background:'rgba(255,59,48,0.9)',color:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}
                        onClick={()=>setConfirmDeleteId(selectedId)}>✕</button>
                    </div>
                  )
                })()}

              </div>{/* /inner floor (roomRef) */}
              </div>{/* /outer wall shell */}
            </div>{/* /padding wrapper */}
          </div>{/* /canvas scroll area */}

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexShrink:0}}>
            <p style={{margin:0,fontSize:10,color:'#ccc',fontWeight:500,fontFamily:'monospace',flex:1}}>{t.hint}</p>
            <button onClick={saveLayout}
              style={{
                padding:'6px 16px',border:'none',
                background:savedLayout?'#5B8EFF':'#C8EC28',
                color:'#111',fontFamily:'inherit',fontSize:11,fontWeight:700,
                cursor:'pointer',borderRadius:999,flexShrink:0,
                transition:'all 0.15s',whiteSpace:'nowrap',
              }}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}
            >{savedLayout?t.renewBtn:t.saveBtn}</button>
          </div>
        </div>

        </div>{/* ── /Middle column ── */}

        {/* ── Chat Card ── */}
        <div style={{background:'#fff',borderRadius:14,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:isMobile?300:0}}>

          {/* Messages */}
          <div style={{flex:1,overflowY:'auto',padding:'18px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {messages.map((msg,i)=>(
              <div key={i} style={{display:'flex',flexDirection:msg.role==='user'?'row-reverse':'row',gap:8,alignItems:'flex-start'}}>
                {msg.role==='assistant'&&(
                  <div style={{width:28,height:28,borderRadius:'50%',background:'#111',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <img src="/logo.svg" style={{width:16,height:16,objectFit:'contain',filter:'invert(1)'}} alt=""/>
                  </div>
                )}
                <div style={{maxWidth:'78%',display:'flex',flexDirection:'column',alignItems:msg.role==='user'?'flex-end':'flex-start',gap:3}}>
                  <div style={{
                    padding:'10px 14px',
                    borderRadius:msg.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',
                    background:msg.role==='user'?'#111':'#f5f5f5',
                    color:msg.role==='user'?'#fff':'#111',
                    fontSize:13,lineHeight:1.65,whiteSpace:'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'#111',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <img src="/logo.svg" style={{width:16,height:16,objectFit:'contain',filter:'invert(1)'}} alt=""/>
                </div>
                <div style={{padding:'12px 16px',borderRadius:'18px 18px 18px 4px',background:'#f5f5f5',display:'flex',gap:5,alignItems:'center'}}>
                  {[0,1,2].map(n=><div key={n} style={{width:6,height:6,background:'#ccc',borderRadius:'50%',animation:`bounce 1.2s ease-in-out ${n*0.2}s infinite`}}/>)}
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Quick prompts */}
          <div style={{padding:'0 14px 10px',display:'flex',gap:5,flexWrap:'wrap'}}>
            {t.quick.map(p=>(
              <button key={p} onClick={()=>sendMessage(p)} disabled={loading}
                style={{padding:'5px 11px',border:'1.5px solid #eee',background:'transparent',color:'#666',fontSize:11,fontWeight:500,cursor:loading?'not-allowed':'pointer',opacity:loading?0.4:1,borderRadius:999,transition:'all 0.1s'}}
                onMouseEnter={e=>{if(!loading){e.currentTarget.style.background='#C8EC28';e.currentTarget.style.color='#111';e.currentTarget.style.borderColor='#C8EC28'}}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#666';e.currentTarget.style.borderColor='#eee'}}
              >{p}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{padding:'10px 14px 14px',display:'flex',gap:8,borderTop:'1px solid #f0f0f0'}}>
            <input value={inputValue} onChange={e=>setInputValue(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMessage()}
              placeholder={t.placeholder}
              style={{flex:1,padding:'10px 16px',border:'1.5px solid #eee',background:'#f9f9f9',fontSize:13,color:'#111',outline:'none',fontFamily:'inherit',borderRadius:999}}
            />
            <button onClick={()=>sendMessage()} disabled={loading||!inputValue.trim()}
              style={{padding:'10px 18px',border:'none',background:(loading||!inputValue.trim())?'#eee':'#C8EC28',color:(loading||!inputValue.trim())?'#aaa':'#111',fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:(loading||!inputValue.trim())?'not-allowed':'pointer',borderRadius:999,whiteSpace:'nowrap',transition:'all 0.15s'}}
            >{loading?'…':t.sendBtn}</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Mini components ──────────────────────────────────────────────────────────

function PillBtn({ children, active, disabled, onClick }) {
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{
        padding:'5px 14px',
        border: active ? 'none' : '1.5px solid #eee',
        fontFamily:'inherit', fontSize:11, fontWeight:600,
        cursor:disabled?'not-allowed':'pointer',
        borderRadius:999, transition:'all 0.1s',
        background: active ? '#C8EC28' : 'transparent',
        color: active ? '#111' : '#666',
        opacity: disabled ? 0.4 : 1,
        letterSpacing:'0.3px',
        textTransform:'uppercase',
      }}
    >{children}</button>
  )
}

function VSep() {
  return <div style={{width:1,height:18,background:'#eee',flexShrink:0}}/>
}
