import { useEffect, useRef, useState } from 'react'

// ---- 랜덤 값 생성 헬퍼 (전부 가짜 값. 실제 IP/도메인/회사명 사용 안 함) ----
const HEX_CHARS = '0123456789abcdef'
const rand = (n) => Math.floor(Math.random() * n)
const randHex = (len) =>
  Array.from({ length: len }, () => HEX_CHARS[rand(16)]).join('')
const randByte = () => rand(256)
const randPort = () => 1024 + rand(60000)

// 사설 IP 대역만 사용 (10.x / 192.168.x / 172.16~31.x)
function randPrivateIP() {
  const ranges = [
    () => `10.${randByte()}.${randByte()}.${randByte()}`,
    () => `192.168.${randByte()}.${randByte()}`,
    () => `172.${16 + rand(16)}.${randByte()}.${randByte()}`,
  ]
  return ranges[rand(ranges.length)]()
}

const SYSCALLS = ['open', 'read', 'write', 'mmap', 'connect', 'execve', 'ioctl', 'clone', 'futex', 'poll']
const MODULES = ['kernel32.sys', 'ntdll.dll', 'libcrypto.so', 'auth_module', 'net_stack', 'vfs_layer', 'session_mgr']

// 가짜 로그 한 줄을 생성하는 템플릿들
const LOG_GENERATORS = [
  () => `[${randHex(8)}] SYSCALL ${SYSCALLS[rand(SYSCALLS.length)]} -> ${MODULES[rand(MODULES.length)]} (pid ${1000 + rand(9000)})`,
  () => `CONNECT ${randPrivateIP()}:${randPort()} ... established`,
  () => `HANDSHAKE hash=${randHex(16)}`,
  () => `DECRYPT block 0x${randHex(4)} using key ${randHex(12)}`,
  () => `SCAN subnet ${randPrivateIP().split('.').slice(0, 3).join('.')}.0/24`,
  () => `MOUNT /dev/sec${rand(9)} -> /mnt/vault`,
  () => `PATCH memory offset 0x${randHex(6)}`,
  () => `VERIFY signature ${randHex(20)} ... OK`,
  () => `SPAWN worker_thread#${rand(64)} priority=${rand(10)}`,
  () => `TRACE route hop ${rand(30)} -> ${randPrivateIP()}`,
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function App() {
  const [lines, setLines] = useState([])
  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState(0)
  const [granted, setGranted] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    runSequence()
    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function typeLine(text) {
    for (let i = 1; i <= text.length; i++) {
      if (cancelledRef.current) return
      setTyped(text.slice(0, i))
      await sleep(10 + Math.random() * 20)
    }
    await sleep(120)
  }

  async function runSequence() {
    while (!cancelledRef.current) {
      setLines([])
      setTyped('')
      setProgress(0)
      setGranted(false)

      const totalLines = 10 + rand(6)
      for (let i = 0; i < totalLines; i++) {
        if (cancelledRef.current) return
        const text = LOG_GENERATORS[rand(LOG_GENERATORS.length)]()
        await typeLine(text)
        if (cancelledRef.current) return
        setLines((prev) => [...prev.slice(-11), text])
        setTyped('')
        setProgress(Math.round(((i + 1) / totalLines) * 100))
      }

      if (cancelledRef.current) return
      await sleep(400)
      setGranted(true)
      await sleep(2400)
    }
  }

  return (
    <div className="terminal-wrapper">
      <div className="scanlines" />
      <div className="vignette" />
      <div className={`terminal ${granted ? 'glitch' : ''}`}>
        <div className="terminal-header">root@localhost: ~# secure_access.sh</div>
        <div className="terminal-body">
          {lines.map((line, idx) => (
            <div className="log-line" key={idx}>
              {line}
            </div>
          ))}
          {!granted && (
            <div className="log-line typing-line">
              {typed}
              <span className="cursor">▍</span>
            </div>
          )}
          {granted && <div className="granted-banner">ACCESS GRANTED</div>}
        </div>

        {!granted && (
          <div className="progress-wrap">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-label">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
