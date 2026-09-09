import { useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------
   랜덤 값 생성 헬퍼 — 전부 가짜 값 (실제 IP/도메인/회사명 사용 안 함)
------------------------------------------------------------------ */
const HEX = '0123456789abcdef'
const HEX_UP = '0123456789ABCDEF'
const rand = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rand(arr.length)]
const randHex = (len) => Array.from({ length: len }, () => HEX[rand(16)]).join('')
const randHexUp = (len) => Array.from({ length: len }, () => HEX_UP[rand(16)]).join('')
const randByte = () => rand(256)
const randPort = () => 1024 + rand(60000)
const randPid = () => 400 + rand(9600)
const pad = (v, n) => String(v).padEnd(n, ' ')
const padL = (v, n) => String(v).padStart(n, ' ')
const pad0 = (v, n) => String(v).padStart(n, '0')

// 사설 IP 대역만 사용 (10.x / 192.168.x / 172.16~31.x)
function randPrivateIP() {
  return pick([
    () => `10.42.${rand(16)}.${1 + rand(253)}`,
    () => `192.168.${rand(4)}.${1 + rand(253)}`,
    () => `172.${16 + rand(16)}.${randByte()}.${1 + rand(253)}`,
  ])()
}
const randMac = () => Array.from({ length: 6 }, () => randHexUp(2)).join('-')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MAX_LINES = 90

/* ------------------------------------------------------------------
   콘솔 1개를 구동하는 훅
   driver(api) 안에서 await api.wait() / api.print() 로 시나리오를 씀
------------------------------------------------------------------ */
const CANCEL = Symbol('cancelled')

function useConsole(driver) {
  const [lines, setLines] = useState([])
  const bodyRef = useRef(null)

  useEffect(() => {
    // 취소 플래그는 이 실행에만 속한 로컬 값 (StrictMode 재마운트 시 중복 실행 방지)
    let dead = false

    const guard = () => {
      if (dead) throw CANCEL
    }

    const api = {
      async wait(ms) {
        await sleep(ms)
        guard()
      },
      print(text = '', cls) {
        guard()
        setLines((prev) => [...prev, { text, cls }].slice(-MAX_LINES))
      },
      // 마지막 줄을 갱신 (진행바 / 스피너 / 타이핑용)
      replace(text = '', cls) {
        guard()
        setLines((prev) =>
          prev.length === 0 ? [{ text, cls }] : [...prev.slice(0, -1), { text, cls }],
        )
      },
      // 실제 콘솔처럼 여러 줄이 한 번에 쏟아지는 느낌
      async burst(rows, min = 12, max = 55) {
        for (const row of rows) {
          const [text, cls] = Array.isArray(row) ? row : [row, undefined]
          api.print(text, cls)
          await api.wait(min + Math.random() * (max - min))
        }
      },
      // 명령어 입력만 한 글자씩 (사람이 타이핑하는 부분)
      async type(prefix, cmd, cls = 'cmd') {
        api.print(prefix, cls)
        for (let i = 1; i <= cmd.length; i++) {
          api.replace(prefix + cmd.slice(0, i), cls)
          await api.wait(28 + Math.random() * 45)
        }
        await api.wait(220 + Math.random() * 380)
      },
      clear() {
        guard()
        setLines([])
      },
    }

    ;(async () => {
      try {
        await driver(api)
      } catch (e) {
        if (e !== CANCEL) throw e
      }
    })()

    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 항상 맨 아래로 스크롤 (실제 콘솔 동작)
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  return { lines, bodyRef }
}

/* ------------------------------------------------------------------
   콘솔 창 UI — 윈도우 기본 창틀(라이트 크롬) + 내부는 각기 다른 색
------------------------------------------------------------------ */
function ConsoleWindow({ title, icon, theme, active, driver }) {
  const { lines, bodyRef } = useConsole(driver)

  return (
    <div className={`win ${active ? 'win-active' : ''} theme-${theme}`}>
      <div className="win-title">
        <span className="win-icon">{icon}</span>
        <span className="win-caption">{title}</span>
        <span className="win-buttons">
          <span className="win-btn win-min">&#9473;</span>
          <span className="win-btn win-max">&#9633;</span>
          <span className="win-btn win-close">&#10005;</span>
        </span>
      </div>
      <div className="win-body" ref={bodyRef}>
        {lines.map((l, i) => (
          <div className={`ln ${l.cls || ''}`} key={i}>
            {l.text === '' ? '\u00a0' : l.text}
            {i === lines.length - 1 && <span className="caret">&#9608;</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==================================================================
   1) Windows PowerShell
================================================================== */
const PS_PROMPT = 'PS C:\\Users\\admin> '

const PS_TASKS = [
  // 서브넷 스윕
  async (api) => {
    await api.type(PS_PROMPT, '.\\Invoke-NetSweep.ps1 -Subnet 10.42.7.0/24 -Threads 64')
    await api.burst([
      ['VERBOSE: thread pool initialized (64 workers)', 'dim'],
      '',
      ['Address           Status     RTT(ms)   MAC', 'hdr'],
      ['-------           ------     -------   ---', 'dim'],
    ])
    const n = 7 + rand(6)
    for (let i = 0; i < n; i++) {
      const up = Math.random() > 0.28
      api.print(
        `${pad(randPrivateIP(), 18)}${pad(up ? 'Up' : 'Filtered', 11)}${padL(up ? 1 + rand(80) : '-', 7)}   ${up ? randMac() : '-'}`,
        up ? 'ok' : 'dim',
      )
      await api.wait(60 + Math.random() * 190)
    }
    await api.burst([
      '',
      [`VERBOSE: sweep completed in ${(2 + Math.random() * 6).toFixed(2)}s`, 'dim'],
      [`WARNING: ${1 + rand(4)} host(s) did not answer ICMP; falling back to TCP/445`, 'warn'],
      '',
    ])
  },
  // TCP 연결 목록
  async (api) => {
    await api.type(PS_PROMPT, 'Get-NetTCPConnection -State Established | Sort RemoteAddress')
    await api.burst([
      '',
      ['LocalAddress    LocalPort RemoteAddress    RemotePort State       OwningProcess', 'hdr'],
      ['------------    --------- -------------    ---------- -----       -------------', 'dim'],
    ])
    for (let i = 0; i < 6 + rand(5); i++) {
      api.print(
        `${pad(randPrivateIP(), 16)}${pad(randPort(), 10)}${pad(randPrivateIP(), 17)}${pad(randPort(), 11)}${pad('Established', 12)}${randPid()}`,
      )
      await api.wait(35 + Math.random() * 90)
    }
    api.print('')
  },
  // 원격 세션 시도 → 실패 후 재시도 성공
  async (api) => {
    const host = randPrivateIP()
    await api.type(PS_PROMPT, `Enter-PSSession -ComputerName ${host} -Authentication Negotiate`)
    await api.burst(
      [
        ['VERBOSE: resolving WinRM endpoint tcp/5985', 'dim'],
        ['VERBOSE: negotiating credentials for workgroup WRKGRP-07', 'dim'],
      ],
      200,
      520,
    )
    await api.wait(700)
    await api.burst([
      [`Enter-PSSession : ${host}에 연결하지 못했습니다. 액세스가 거부되었습니다.`, 'err'],
      ['위치 줄:1 문자:1', 'err'],
      [`+ Enter-PSSession -ComputerName ${host} -Authentication Negotiate`, 'err'],
      ['+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', 'err'],
      [`    + CategoryInfo          : InvalidArgument: (${host}:String) [Enter-PSSession]`, 'err'],
      ['    + FullyQualifiedErrorId : CreateRemoteRunspaceFailed', 'err'],
      '',
      [`VERBOSE: retrying with cached ticket ${randHexUp(8)}`, 'dim'],
      [`[+] session opened -> ${host}  (runspace ${randHex(8)})`, 'ok'],
      '',
    ])
  },
  // 서비스 프로세스 조회
  async (api) => {
    await api.type(PS_PROMPT, 'Get-Process svc_* | Select Id,Handles,WS,CPU | ft -Auto')
    await api.burst([
      '',
      ['   Id Handles        WS     CPU  ProcessName', 'hdr'],
      ['   -- -------        --     ---  -----------', 'dim'],
    ])
    for (let i = 0; i < 5 + rand(4); i++) {
      api.print(
        `${padL(randPid(), 5)} ${padL(100 + rand(900), 7)} ${padL((10 + rand(400)) * 1024, 9)} ${padL(
          (Math.random() * 40).toFixed(2),
          7,
        )}  svc_${pick(['auth', 'relay', 'index', 'vault', 'sched', 'crypt'])}_${randHex(3)}`,
      )
      await api.wait(40 + Math.random() * 110)
    }
    api.print('')
  },
]

async function powershellDriver(api) {
  await api.burst(
    [
      'Windows PowerShell',
      'Copyright (C) Microsoft Corporation. All rights reserved.',
      '',
      ['새로운 기능 및 향상된 기능을 살펴보려면 최신 PowerShell을 설치하세요.', 'dim'],
      '',
    ],
    60,
    140,
  )

  while (true) {
    await PS_TASKS[rand(PS_TASKS.length)](api)
    await api.wait(400 + Math.random() * 900)
    if (Math.random() < 0.12) {
      await api.type(PS_PROMPT, 'cls')
      await api.wait(180)
      api.clear()
    }
  }
}

/* ==================================================================
   2) 명령 프롬프트 (cmd.exe)
================================================================== */
const CMD_PROMPT = 'C:\\Windows\\system32>'

const CMD_TASKS = [
  async (api) => {
    await api.type(CMD_PROMPT, 'netstat -ano | findstr ESTABLISHED')
    await api.wait(400)
    for (let i = 0; i < 8 + rand(7); i++) {
      api.print(
        `  TCP    ${pad(randPrivateIP() + ':' + randPort(), 23)}${pad(
          randPrivateIP() + ':' + randPort(),
          23,
        )}${pad('ESTABLISHED', 14)}${randPid()}`,
      )
      await api.wait(18 + Math.random() * 55)
    }
    api.print('')
  },
  async (api) => {
    const file = `C:\\Windows\\Temp\\${randHex(6)}.bin`
    await api.type(CMD_PROMPT, `certutil -hashfile ${file} SHA256`)
    await api.burst(
      [
        `SHA256 해시(대상 파일 ${file}):`,
        [randHex(64), 'accent'],
        'CertUtil: -hashfile 명령이 성공적으로 완료되었습니다.',
        '',
      ],
      120,
      320,
    )
  },
  async (api) => {
    const src = `\\\\${randPrivateIP()}\\vault$`
    const dst = `D:\\stage\\${randHex(4)}`
    await api.type(CMD_PROMPT, `robocopy ${src} ${dst} /MIR /Z /R:1 /W:1 /NP`)
    await api.burst(
      [
        '',
        ['-------------------------------------------------------------------------------', 'dim'],
        ['   ROBOCOPY     ::     Robust File Copy for Windows', 'dim'],
        ['-------------------------------------------------------------------------------', 'dim'],
        '',
        `  Source : ${src}\\`,
        `    Dest : ${dst}\\`,
        '',
      ],
      40,
      120,
    )
    const n = 6 + rand(6)
    let failed = 0
    for (let i = 0; i < n; i++) {
      const size = (Math.random() * 900).toFixed(1)
      api.print(
        `  New File  ${padL(size + ' m', 12)}  ${pick(['db', 'idx', 'snap', 'blob', 'dump'])}_${randHex(
          5,
        )}.${pick(['dat', 'bak', 'bin', 'log'])}`,
      )
      await api.wait(90 + Math.random() * 260)
      if (Math.random() < 0.22) {
        failed++
        api.print('  ERROR 5 (0x00000005) 파일 복사 중 액세스가 거부되었습니다.', 'err')
        await api.wait(160)
      }
    }
    await api.burst(
      [
        '',
        ['               Total    Copied   Skipped  Mismatch    FAILED', 'dim'],
        `    Files : ${padL(n, 7)}${padL(n - failed, 10)}${padL(1, 10)}${padL(0, 10)}${padL(failed, 10)}`,
        '',
      ],
      60,
      140,
    )
  },
  async (api) => {
    await api.type(CMD_PROMPT, 'tasklist /svc /fi "SESSIONNAME eq Services"')
    await api.burst([
      '',
      ['이미지 이름                     PID 서비스', 'hdr'],
      ['========================= ======= =========================================', 'dim'],
    ])
    for (let i = 0; i < 6 + rand(5); i++) {
      api.print(
        `${pad(
          pick(['svc_relay.exe', 'idxhost.exe', 'authbrk.exe', 'vaultsvc.exe', 'netbind.exe', 'schedhost.exe']),
          26,
        )}${padL(randPid(), 7)} ${pick(['RelaySvc', 'IdxHost', 'AuthBrk', 'VaultSvc', 'NetBind', 'N/A'])}`,
      )
      await api.wait(30 + Math.random() * 80)
    }
    api.print('')
  },
  async (api) => {
    await api.type(CMD_PROMPT, 'for /f %i in (targets.txt) do @ping -n 1 %i | find "TTL="')
    await api.wait(300)
    for (let i = 0; i < 6 + rand(5); i++) {
      const ip = randPrivateIP()
      if (Math.random() > 0.25) {
        api.print(`${ip}의 응답: 바이트=32 시간=${1 + rand(60)}ms TTL=${pick([64, 128, 255])}`)
      } else {
        api.print('요청 시간이 만료되었습니다.', 'dim')
      }
      await api.wait(120 + Math.random() * 300)
    }
    api.print('')
  },
]

async function cmdDriver(api) {
  await api.burst(
    ['Microsoft Windows [Version 10.0.26100.2314]', '(c) Microsoft Corporation. All rights reserved.', ''],
    80,
    160,
  )
  while (true) {
    await CMD_TASKS[rand(CMD_TASKS.length)](api)
    await api.wait(500 + Math.random() * 1100)
  }
}

/* ==================================================================
   3) 침투 시퀀스 (bash / 초록 터미널) — 마지막에 ACCESS GRANTED
================================================================== */
function bar(pct, width = 26) {
  const filled = Math.round((pct / 100) * width)
  return `[${'#'.repeat(filled)}${'.'.repeat(width - filled)}] ${padL(pct, 3)}%`
}

async function breachDriver(api) {
  while (true) {
    api.clear()
    const target = randPrivateIP()
    await api.burst(
      [
        ['Linux relay-node 5.15.0-generic #1 SMP x86_64', 'dim'],
        [`Last login: Tue Sep  9 0${rand(9)}:${pad0(rand(60), 2)}:${pad0(rand(60), 2)} from ${randPrivateIP()}`, 'dim'],
        '',
      ],
      60,
      140,
    )

    await api.type('root@relay-node:~# ', `./breach --target ${target} --profile stealth`)

    await api.burst(
      [
        [`[*] loading modules: ${pick(['net_stack', 'vfs_layer', 'session_mgr'])}, auth_module`, 'dim'],
        [`[*] fingerprinting ${target}`, 'info'],
        [`[+] os guess    : generic-unix 5.15.x  (confidence ${70 + rand(28)}%)`, 'ok'],
        [`[+] hostname    : node-${randHex(4)}`, 'ok'],
        '',
        ['    PORT     STATE    SERVICE      BANNER', 'hdr'],
        `    22/tcp   open     ssh          OpenSSH-like ${5 + rand(4)}.${rand(9)}`,
        `    445/tcp  open     smb-alike    workgroup WRKGRP-0${rand(9)}`,
        `    ${randPort()}/tcp open     unknown      ${randHex(12)}`,
        '    5985/tcp filtered wsman        -',
        '',
      ],
      90,
      260,
    )

    // 키 브루트포스 진행바
    api.print(`[*] brute forcing session keys (dict ${120 + rand(400)}k entries)`, 'info')
    api.print(bar(0), 'dim')
    for (let p = 0; p <= 100; p += 1 + rand(4)) {
      api.replace(bar(Math.min(p, 100)), 'dim')
      await api.wait(24 + Math.random() * 55)
    }
    api.replace(bar(100), 'dim')

    await api.burst(
      [
        [`[+] key recovered: ${randHex(32)}`, 'ok'],
        '',
        [`[*] pivoting through ${randPrivateIP()} -> ${randPrivateIP()}`, 'info'],
        [`[*] injecting into pid ${randPid()} (${pick(['session_mgr', 'auth_module', 'net_stack'])})`, 'info'],
        [`[!] seatbelt check tripped, sleeping ${1 + rand(3)}s`, 'warn'],
      ],
      140,
      380,
    )

    await api.wait(900)
    await api.burst(
      [
        [`[+] handshake ok   hash=${randHex(16)}`, 'ok'],
        [`[*] escalating: exploiting offset 0x${randHex(6)}`, 'info'],
        ['[+] privilege escalation succeeded', 'ok'],
        '',
        ['uid=0(root) gid=0(root) groups=0(root)', 'accent'],
        '',
      ],
      120,
      300,
    )

    await api.wait(400)
    api.print('  *** ACCESS GRANTED ***  ', 'granted')
    api.print('')
    await api.burst(
      [
        [`[*] dropping persistence -> /etc/init.d/.${randHex(6)}`, 'dim'],
        [`[*] session ${randHex(10)} handed to operator console`, 'dim'],
      ],
      200,
      400,
    )
    await api.wait(2600)
  }
}

/* ==================================================================
   4) 무한 로딩 콘솔 — 절대 끝나지 않고 계속 올라감
================================================================== */
const SPIN = ['|', '/', '-', '\\']
const JOBS = [
  'syncing shard',
  'rebuilding index',
  'replaying journal',
  'streaming blocks',
  'verifying chunks',
  'compacting segment',
  'flushing write-ahead log',
  'mirroring volume',
  'resolving dep graph',
  'hydrating cache',
]

async function loaderDriver(api) {
  let shard = 1
  let seq = 4000 + rand(2000)

  await api.burst(
    [
      [`nexus-agent 2.7.14  (build ${randHex(7)})`, 'accent'],
      ['worker pool online: 8 threads / queue depth 0', 'dim'],
      '',
    ],
    80,
    160,
  )

  while (true) {
    const job = pick(JOBS)
    const total = 32 + rand(96)
    const label = `${job} ${padL(shard, 2)}/${total}`

    api.print('', 'dim')
    let pct = 0
    let frame = 0
    while (pct < 100) {
      pct = Math.min(100, pct + 1 + rand(5))
      frame++
      const w = 22
      const f = Math.round((pct / 100) * w)
      api.replace(
        `${SPIN[frame % 4]} ${pad(label, 30)}${'='.repeat(f)}${' '.repeat(w - f)} ${padL(pct, 3)}%`,
        'info',
      )
      await api.wait(45 + Math.random() * 70)
    }
    api.replace(`  ${pad(label, 30)}${'='.repeat(22)} 100%  ok`, 'ok')

    // 사이사이 실제 로그처럼 잡음 섞기
    const noise = 1 + rand(4)
    for (let i = 0; i < noise; i++) {
      seq++
      const t = new Date()
      const stamp = `${pad0(t.getHours(), 2)}:${pad0(t.getMinutes(), 2)}:${pad0(t.getSeconds(), 2)}.${pad0(
        t.getMilliseconds(),
        3,
      )}`
      const r = Math.random()
      if (r < 0.12) {
        api.print(`${stamp}  WARN   seq=${seq} backpressure on queue ${randHex(4)}, retry in ${1 + rand(5)}s`, 'warn')
      } else if (r < 0.18) {
        api.print(`${stamp}  ERROR  seq=${seq} chunk ${randHex(8)} checksum mismatch - requeued`, 'err')
      } else {
        api.print(
          `${stamp}  INFO   seq=${seq} ${pick([
            `wrote ${(Math.random() * 90).toFixed(1)} MiB to /mnt/vault/${randHex(6)}`,
            `peer ${randPrivateIP()}:${randPort()} ack rtt=${(Math.random() * 40).toFixed(1)}ms`,
            `gc pass ${rand(400)} reclaimed ${rand(900)} MiB`,
            `worker#${rand(8)} lease renewed (ttl ${20 + rand(40)}s)`,
            `manifest ${randHex(12)} verified`,
            `queue depth ${rand(120)} / inflight ${rand(64)}`,
          ])}`,
          'dim',
        )
      }
      await api.wait(70 + Math.random() * 220)
    }

    shard = shard >= total ? 1 : shard + 1
    await api.wait(150 + Math.random() * 350)
  }
}

/* ================================================================== */
export default function App() {
  return (
    <div className="desktop">
      <ConsoleWindow title="Windows PowerShell" icon=">_" theme="ps" driver={powershellDriver} />
      <ConsoleWindow
        title="관리자: C:\Windows\system32\cmd.exe"
        icon="C:"
        theme="cmd"
        driver={cmdDriver}
      />
      <ConsoleWindow title="root@relay-node: ~" icon="$_" theme="bash" active driver={breachDriver} />
      <ConsoleWindow title="nexus-agent — worker log" icon="~" theme="loader" driver={loaderDriver} />
    </div>
  )
}
