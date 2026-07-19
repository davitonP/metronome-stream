const SONG_DATA_URL = "/assets/letras/cuan_grande_es_dios.json"
let timelineScrollMode = "izquierda"

// ---- Reproducción de YouTube (puente con lite-youtube) ----
// Permite que el botón de play controle también el video de YouTube.
const ytLite = document.querySelector("lite-youtube")
let ytPlayer = null
let ytPlayerReady = false
let ytApiReady = false
// Asignado por renderSongTimeline para sincronizar el botón de play con el video.
let ytStateHandler = null

function tryBuildYtPlayer() {
    if (ytPlayer || !ytApiReady || !ytLite) return
    if (!window.YT || !window.YT.Player) return
    const iframe = ytLite.shadowRoot && ytLite.shadowRoot.querySelector("iframe")
    if (!iframe) return
    ytPlayer = new window.YT.Player(iframe, {
        events: {
            onReady: () => {
                ytPlayerReady = true
                if (typeof ytStateHandler === "function") ytStateHandler("sync")
            },
            onStateChange: (event) => {
                if (typeof ytStateHandler !== "function") return
                const YT = window.YT
                if (event.data === YT.PlayerState.PLAYING) ytStateHandler("playing")
                else if (event.data === YT.PlayerState.PAUSED) ytStateHandler("paused")
                else if (event.data === YT.PlayerState.ENDED) ytStateHandler("ended")
            }
        }
    })
}

window.onYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady || function () {
    ytApiReady = true
    tryBuildYtPlayer()
}

if (ytLite && !document.getElementById("youtube-iframe-api")) {
    const tag = document.createElement("script")
    tag.id = "youtube-iframe-api"
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
}

if (ytLite) {
    ytLite.addEventListener("liteYoutubeIframeLoaded", () => tryBuildYtPlayer())
}

function controlYoutube(shouldPlay) {
    if (!ytLite) return
    if (!ytPlayer || !ytPlayerReady) {
        // Primera reproducción: carga el iframe de lite-youtube (autoreproduce).
        if (shouldPlay) ytLite.click()
        return
    }
    if (shouldPlay) ytPlayer.playVideo()
    else ytPlayer.pauseVideo()
}

function toSolfege(chord) {
    if (!chord) return chord
    const map = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" }
    const match = String(chord).trim().match(/^([A-G])([#b]?)(.*)$/)
    if (!match) return chord
    const [, root, accidental, rest] = match
    return `${map[root] || root}${accidental}${rest}`
}

function updateSongInfo(song) {
    const title = document.getElementById("song-title")
    const artist = document.getElementById("song-artist")
    const key = document.getElementById("song-key")
    const tempo = document.getElementById("song-tempo")
    const timeSignature = document.getElementById("song-time signature")

    title.textContent = song.title
    artist.textContent = song.artist
    key.textContent = song.key
    tempo.textContent = song.bpm
    timeSignature.textContent = song.timeSignature
}

async function renderSongTimeline() {
    const root = document.getElementById("song-timeline-root")
    if (!root) {
        return
    }

    try {
        const response = await fetch("/assets/templates/song-timeline-template.html")
        if (!response.ok) {
            throw new Error("No se pudo cargar la plantilla")
        }

        const html = await response.text()
        root.innerHTML = html

        // Botones "Izquierda" / "Seguir" — viven en la plantilla
        const modeButtons = root.querySelectorAll(".timeline-mode-btn")
        const syncModeButtons = () => {
            modeButtons.forEach((btn) => {
                const active = btn.dataset.mode === timelineScrollMode
                btn.classList.toggle("bg-cyan-500/15", active)
                btn.classList.toggle("text-cyan-200", active)
                btn.classList.toggle("text-slate-400", !active)
                btn.classList.toggle("hover:text-slate-200", !active)
            })
        }
        modeButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                timelineScrollMode = btn.dataset.mode
                syncModeButtons()
            })
        })
        syncModeButtons()
    } catch (error) {
        console.warn("No se pudo cargar la plantilla del timeline:", error)
        root.innerHTML = '<div class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 text-sm text-slate-400">No se pudo cargar la plantilla.</div>'
        return
    }

    const windowLetra = document.getElementById("timeline-container")
    if (!windowLetra) {
        return
    }

    windowLetra.innerHTML = ""

    const track = document.createElement("div")
    track.className = "rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4"

    let songData = null

    try {
        const response = await fetch(SONG_DATA_URL)
        if (response.ok) {
            songData = await response.json()
        }
    } catch (error) {
        console.warn("No se pudo cargar la letra desde JSON:", error)
    }

    if (!songData) {
        return
    }

    const bpm = songData.metadata?.bpm || 120
    const bpmTime = 60000 / bpm
    // Retardo (en ms) entre el inicio del video y el de la animación:
    // compensa que la canción en el video no suele empezar en el segundo 0.00.
    const animationDelayMs = (Number(songData.metadata?.animationDelay) || 0) * 1000
    updateSongInfo(songData.metadata)
    // console.log("BPM:", bpm)

    if (Array.isArray(songData.sections) && songData.sections.length > 0) {
        track.className = "space-y-4"

        // Resolvemos el orden real de las secciones desde `structure` (lista de
        // nombres, con repeticiones). Así el Coro se define una sola vez en
        // `sections` pero puede aparecer varias veces en el timeline.
        const sectionDefs = songData.sections
        const sectionByName = new Map()
        sectionDefs.forEach((section) => {
            if (section && section.name) {
                sectionByName.set(String(section.name).toLowerCase(), section)
            }
        })
        const structureList = Array.isArray(songData.structure) && songData.structure.length > 0
            ? songData.structure
            : sectionDefs.map((section) => section.name)
        // Una instancia por entrada de structure (cada repetición es única).
        const sectionInstances = structureList.map((name, index) => {
            const rawName = String(name)
            const def = sectionByName.get(rawName.toLowerCase())
            if (!def) {
                console.warn(`La entrada "${rawName}" en structure no coincide con ninguna sección definida (disponibles: ${sectionDefs.map(s => s.name).join(", ")}).`)
                return { index, name: rawName, def: { name: rawName, items: [] }, missing: true, rawName }
            }
            return { index, name: def.name || rawName, def }
        })
        const missingSections = sectionInstances.filter((i) => i.missing)

        // Flatten sections -> one grid cell per beat + one lyric entry per item
        const cells = []
        const lyricCells = []
        const lyrics = []
        let prevMeasure = null
        let itemIndex = 0

        sectionInstances.forEach((instance) => {
            const section = instance.def
            const items = Array.isArray(section.items) ? section.items : []
            // Reiniciamos el compás previo al iniciar cada instancia para que
            // las secciones repetidas arranquen con borde de compás limpio.
            prevMeasure = null
            items.forEach((item) => {
                const beats = Math.max(1, Math.floor(Number(item.duration) || 1))
                const startsMeasure = item.measure !== prevMeasure && (!item.beat || item.beat === 1)

                lyrics.push({
                    itemIndex,
                    sectionName: instance.name,
                    chord: item.chord || "",
                    text: item.text || ""
                })

                for (let beat = 0; beat < beats; beat += 1) {
                    cells.push({
                        itemIndex,
                        sectionIndex: instance.index,
                        sectionName: instance.name,
                        chord: beat === 0 ? (item.chord || "") : "",
                        measureStart: beat === 0 && startsMeasure
                    })
                    // Celda de letra por beat: el texto va en el primer beat
                    // del ítem y se desborda sobre los siguientes visualmente.
                    lyricCells.push({
                        itemIndex,
                        beatFirst: beat === 0,
                        chord: beat === 0 ? (item.chord || "") : "",
                        text: beat === 0 ? (item.text || "") : ""
                    })
                }

                prevMeasure = item.measure
                itemIndex += 1
            })
        })

        // ---- Dark chord-grid card ----
        // El grid de acordes y la fila de letra comparten el mismo contenedor
        // con scroll horizontal, así la letra se mueve junto con los acordes.
        const card = document.createElement("div")
        card.className = "overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-xl"

        const scroller = document.createElement("div")
        scroller.id = "chord-grid"
        scroller.className = "overflow-x-auto"

        const grid = document.createElement("div")
        grid.className = "flex"

        cells.forEach((cell, index) => {
            const cellEl = document.createElement("div")
            cellEl.dataset.step = index
            cellEl.dataset.item = cell.itemIndex
            cellEl.className = [
                "relative flex h-16 min-w-[68px] flex-1 items-center px-3",
                "border-r border-slate-800/80",
                cell.measureStart ? "border-l-2 border-l-slate-600" : "",
                "transition-colors duration-200"
            ].join(" ")

            const raw = (cell.chord || "").trim()
            const isRest = cell.measureStart && (raw === "" || raw === "-" || raw === "%")

            const label = document.createElement("span")
            if (isRest) {
                label.dataset.base = "text-slate-500"
                label.className = "mx-auto text-2xl text-slate-500"
                label.textContent = "𝄽"
            } else if (raw) {
                label.dataset.base = "text-cyan-200"
                label.className = "text-2xl font-semibold text-cyan-200"
                label.textContent = toSolfege(raw)
            }
            cellEl.appendChild(label)
            grid.appendChild(cellEl)
        })

        // Fila de letra: una celda por beat, alineada con el grid de acordes.
        const lyricRow = document.createElement("div")
        lyricRow.className = "flex border-t border-slate-800/80"
        lyricCells.forEach((lc, index) => {
            const cellEl = document.createElement("div")
            cellEl.dataset.step = index
            cellEl.dataset.item = lc.itemIndex
            cellEl.className = [
                "relative min-h-[64px] min-w-[68px] flex-1 border-r border-slate-800/60 px-3 py-2",
                lc.beatFirst ? "border-l-2 border-l-slate-600/60" : "",
                "transition-colors duration-200"
            ].join(" ")

            if (lc.beatFirst) {
                // Se vuelve a colocar el acorde
                if (lc.chord) {
                    const chordTag = document.createElement("p")
                    chordTag.className = "text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-300/80"
                    chordTag.textContent = toSolfege(lc.chord)
                    cellEl.appendChild(chordTag)
                }
                // La sílaba alineada con el acorde se marca con %sílaba%.
                // Ej: "El %es%plendor de un rey" -> before="El ", sílaba="es",
                // after="plendor de un rey". La sílaba queda al inicio de la
                // casilla (alineada con el acorde); "before" se desborda a la
                // izquierda (parte del acorde previo) y "after" fluye a la derecha.
                const raw = lc.text || ""
                const match = raw.match(/^(.*?)%([^%]*)%([\s\S]*)$/)
                const lyricWrapper = document.createElement("p")
                lyricWrapper.className = "relative mt-0.5 whitespace-nowrap text-md leading-5"
                if (match) {
                    const [, before, syllable, after] = match
                    // Mismo color para todo el texto; solo la sílaba va en negrita.
                    const baseTextClass = "text-slate-100"
                    if (before) {
                        const beforeSpan = document.createElement("span")
                        beforeSpan.className = `absolute right-full whitespace-nowrap ${baseTextClass} text-right`
                        // Preserva un espacio final colapsable entre spans.
                        beforeSpan.textContent = before.replace(/ $/, "\u00A0")
                        lyricWrapper.appendChild(beforeSpan)
                    }
                    if (syllable) {
                        const syllSpan = document.createElement("span")
                        syllSpan.className = `font-semibold ${baseTextClass}`
                        syllSpan.textContent = syllable
                        lyricWrapper.appendChild(syllSpan)
                    }
                    if (after) {
                        const afterSpan = document.createElement("span")
                        afterSpan.className = baseTextClass
                        // Preserva un espacio inicial colapsable en la frontera.
                        afterSpan.textContent = after.replace(/^ /, "\u00A0")
                        lyricWrapper.appendChild(afterSpan)
                    }
                } else {
                    lyricWrapper.classList.add("text-slate-100")
                    lyricWrapper.textContent = raw
                }
                cellEl.appendChild(lyricWrapper)
            }
            lyricRow.appendChild(cellEl)
        })

        scroller.appendChild(grid)
        scroller.appendChild(lyricRow)
        card.appendChild(scroller)

        track.appendChild(card)
        windowLetra.appendChild(track)

        // Section cards (current section indicator) — una por entrada de structure
        const sectionsContainer = document.getElementById("timeline-sections")
        const sectionCards = []
        if (sectionsContainer) {
            sectionsContainer.innerHTML = ""
            sectionInstances.forEach((instance) => {
                const card = document.createElement("button")
                card.type = "button"
                card.dataset.section = String(instance.index)
                if (instance.missing) {
                    card.className = "min-w-[100px] cursor-not-allowed rounded-2xl border-2 border-dashed border-amber-400/70 bg-amber-500/10 p-3 text-amber-200 transition-all duration-300"
                    card.title = `La entrada "${instance.rawName}" en structure no coincide con ninguna sección definida. Revisa que el nombre coincida con alguno de: ${sectionDefs.map(s => s.name).join(", ")}.`
                    card.textContent = `⚠ ${instance.name}`
                } else {
                    card.className = "min-w-[100px] cursor-pointer rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3 transition-all duration-300 hover:border-cyan-400/40 hover:text-slate-100"
                    card.textContent = instance.name || `Sección ${instance.index + 1}`
                }
                sectionsContainer.appendChild(card)
                sectionCards.push(card)
            })
        }

        // Highlight the currently playing beat cell (and its lyric line)
        const gridCells = Array.from(grid.querySelectorAll("[data-step]"))
        const lyricCellsEls = Array.from(lyricRow.querySelectorAll("[data-step]"))
        let activeIndex = 0

        const renderActive = () => {
            if (!gridCells.length) return

            gridCells.forEach((cellEl, index) => {
                const isActive = index === activeIndex
                cellEl.classList.toggle("bg-cyan-500/20", isActive)
                cellEl.classList.toggle("shadow-[inset_0_0_0_1px_rgba(34,211,238,0.4)]", isActive)
                const label = cellEl.querySelector("span")
                if (label) {
                    if (isActive) {
                        label.classList.remove("text-cyan-200", "text-slate-500")
                        label.classList.add("text-white")
                    } else {
                        label.classList.remove("text-white")
                        label.classList.add(label.dataset.base || "text-cyan-200")
                    }
                }
            })

            // Resalta la celda de letra del beat actual (alineada con el acorde)
            const activeItem = gridCells[activeIndex]?.dataset.item
            lyricCellsEls.forEach((lyricCell) => {
                const isActive = lyricCell.dataset.step === String(activeIndex)
                lyricCell.classList.toggle("bg-cyan-500/10", isActive)
            })

            const currentSectionIndex = cells[activeIndex]?.sectionIndex
            sectionCards.forEach((card) => {
                const isActive = card.dataset.section === String(currentSectionIndex)
                card.classList.toggle("border-cyan-400/60", isActive)
                card.classList.toggle("bg-cyan-500/20", isActive)
                card.classList.toggle("text-cyan-100", isActive)
                card.classList.toggle("shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)]", isActive)
            })

            // El scroll se controla desde `scroller` (contiene acordes + letra)
            const activeCell = gridCells[activeIndex]
            if (activeCell) {
                const maxScroll = scroller.scrollWidth - scroller.clientWidth
                const scrollerRect = scroller.getBoundingClientRect()
                const cellRect = activeCell.getBoundingClientRect()
                const cellLeftInContent = cellRect.left - scrollerRect.left + scroller.scrollLeft
                const cellWidth = cellRect.width

                if (timelineScrollMode === "izquierda") {
                    const cellsToLeft = 3
                    const target =
                        cellLeftInContent - cellsToLeft * cellWidth
                    scroller.scrollTo({
                        left: Math.max(0, Math.min(target, maxScroll)),
                        behavior: "smooth"
                    })
                } else {
                    const isVisible =
                        cellRect.left >= scrollerRect.left && cellRect.right <= scrollerRect.right
                    if (!isVisible) {
                        const target =
                            cellLeftInContent + cellWidth / 2 -
                            scroller.clientWidth / 4
                        scroller.scrollTo({
                            left: Math.max(0, Math.min(target, maxScroll)),
                            behavior: "smooth"
                        })
                    }
                }
            }
        }

        const advance = () => {
            activeIndex = (activeIndex + 1) % gridCells.length
            renderActive()
        }

        window.clearInterval(window.timelineInterval)
        renderActive()

        // Play / pause control
        const playButton = document.getElementById("timeline-play")
        const playIcon = playButton?.querySelector("[data-play-icon]")
        const pauseIcon = playButton?.querySelector("[data-pause-icon]")
        const statusBadge = document.getElementById("timeline-status")
        const statusDot = statusBadge?.querySelector("[data-status-dot]")
        const statusLabel = statusBadge?.querySelector("[data-status-label]")
        let isPlaying = false
        let pendingPlay = false
        let pendingPlaySkipDelay = false
        let pendingPlayFallback = null
        let countingDown = false
        let countdownToken = 0
        let pendingSeek = null

        const countdownOverlay = document.getElementById("countdown-overlay")
        const countdownNumber = countdownOverlay?.querySelector(".countdown-number")

        const stopCountdown = () => {
            countingDown = false
            countdownToken += 1
            if (countdownOverlay) {
                countdownOverlay.classList.add("hidden")
                countdownOverlay.classList.remove("flex")
                countdownOverlay.dataset.active = "false"
            }
            if (countdownNumber) countdownNumber.textContent = ""
        }

        const showCountNumber = (value) => {
            if (!countdownOverlay || !countdownNumber) return
            countdownNumber.textContent = value
            countdownOverlay.dataset.active = "false"
            // Reinicia la animación de pop
            void countdownNumber.offsetWidth
            countdownOverlay.dataset.active = "true"
        }

        // Cuenta regresiva al ritmo del BPM. Devuelve una promesa que se
        // resuelve al terminar (o se rechaza si se cancela con stopCountdown).
        const runCountdown = () => {
            const token = ++countdownToken
            countingDown = true
            if (countdownOverlay) {
                countdownOverlay.classList.remove("hidden")
                countdownOverlay.classList.add("flex")
            }
            return new Promise((resolve) => {
                let n = 3
                showCountNumber(n)
                const tick = () => {
                    if (token !== countdownToken || !countingDown) {
                        stopCountdown()
                        resolve(false)
                        return
                    }
                    n -= 1
                    if (n <= 0) {
                        stopCountdown()
                        resolve(true)
                    } else {
                        showCountNumber(n)
                        setTimeout(tick, bpmTime)
                    }
                }
                setTimeout(tick, bpmTime)
            })
        }

        let timelineDelayTimeout = null
        const startTimeline = () => {
            window.clearInterval(window.timelineInterval)
            window.timelineInterval = window.setInterval(advance, bpmTime)
        }
        const clearTimelineDelay = () => {
            if (timelineDelayTimeout) {
                clearTimeout(timelineDelayTimeout)
                timelineDelayTimeout = null
            }
        }
        // Arranca el timeline tras el animationDelay del JSON, para que la
        // animación comience cuando realmente inicia la canción en el video.
        // skipDelay = true omite el retardo (usado al saltar a una sección).
        const startTimelineAfterDelay = ({ skipDelay = false } = {}) => {
            clearTimelineDelay()
            if (!skipDelay && animationDelayMs > 0) {
                timelineDelayTimeout = setTimeout(() => {
                    timelineDelayTimeout = null
                    startTimeline()
                }, animationDelayMs)
            } else {
                startTimeline()
            }
        }
        const stopTimeline = () => {
            window.clearInterval(window.timelineInterval)
            clearTimelineDelay()
        }
        const clearPendingFallback = () => {
            if (pendingPlayFallback) {
                clearTimeout(pendingPlayFallback)
                pendingPlayFallback = null
            }
        }

        const setPlaying = (playing, { fromYoutube = false, skipDelay = false } = {}) => {
            // El video confirma reproducción: si estábamos esperando su carga,
            // arrancamos el timeline ahora para no ir por delante del video.
            if (fromYoutube && isPlaying === playing) {
                if (playing && pendingPlay) {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay({ skipDelay: pendingPlaySkipDelay })
                }
                return
            }
            isPlaying = playing
            if (playIcon) playIcon.classList.toggle("hidden", playing)
            if (pauseIcon) pauseIcon.classList.toggle("hidden", !playing)
            if (playButton) playButton.setAttribute("aria-label", playing ? "Pausar" : "Reproducir")
            if (statusLabel) statusLabel.textContent = playing ? "En reproducción" : "En pausa"
            if (statusDot) {
                statusDot.classList.toggle("bg-cyan-300", playing)
                statusDot.classList.toggle("bg-slate-400", !playing)
            }
            if (statusBadge) {
                statusBadge.classList.toggle("border-cyan-400/20", playing)
                statusBadge.classList.toggle("bg-cyan-500/10", playing)
                statusBadge.classList.toggle("text-cyan-300", playing)
                statusBadge.classList.toggle("border-slate-400/20", !playing)
                statusBadge.classList.toggle("bg-slate-500/10", !playing)
                statusBadge.classList.toggle("text-slate-300", !playing)
            }
            if (playing) {
                // Primera reproducción: el iframe aún no está listo. Esperamos a
                // que el video confirme (PLAYING) para arrancar la animación y
                // evitar que vaya por delante. Respaldo por si falla la carga.
                if (!fromYoutube && !ytPlayerReady) {
                    pendingPlay = true
                    pendingPlaySkipDelay = skipDelay
                    stopTimeline()
                    clearPendingFallback()
                    pendingPlayFallback = setTimeout(() => {
                        if (pendingPlay) {
                            pendingPlay = false
                            startTimelineAfterDelay({ skipDelay: pendingPlaySkipDelay })
                        }
                    }, 4000)
                } else {
                    pendingPlay = false
                    clearPendingFallback()
                    startTimelineAfterDelay({ skipDelay })
                }
            } else {
                pendingPlay = false
                pendingSeek = null
                clearPendingFallback()
                stopTimeline()
            }
            if (!fromYoutube) controlYoutube(playing)
        }

        // Sincroniza el botón de play con los cambios de estado del video de YouTube.
        ytStateHandler = (state) => {
            // Durante el conteo regresivo, el video se precarga pero no debe
            // sonar: si empieza a reproducir, lo pausamos. Si acaba de quedar
            // listo (sync), aplicamos un seek pendiente para posicionarlo en la
            // sección elegida, sin reproducir hasta que termine el conteo.
            if (countingDown) {
                if (state === "playing" && ytPlayer && ytPlayerReady) {
                    ytPlayer.pauseVideo()
                } else if (state === "sync" && ytPlayer && ytPlayerReady && pendingSeek != null) {
                    ytPlayer.seekTo(pendingSeek, true)
                    pendingSeek = null
                }
                return
            }
            if (state === "playing") {
                setPlaying(true, { fromYoutube: true })
            } else if (state === "paused" || state === "ended") {
                setPlaying(false, { fromYoutube: true })
            } else if (state === "sync" && ytPlayer && ytPlayerReady) {
                if (pendingSeek != null) {
                    ytPlayer.seekTo(pendingSeek, true)
                    pendingSeek = null
                }
                if (isPlaying) ytPlayer.playVideo()
                else ytPlayer.pauseVideo()
            }
        }

        // Inicia la reproducción con conteo regresivo (3, 2, 1).
        // Precarga el video durante el conteo para que arranque a la par.
        const startWithCountdown = async () => {
            if (countingDown) {
                stopCountdown()
                return
            }
            // Si ya está sonando, el click pausa sin conteo.
            if (isPlaying) {
                setPlaying(false)
                return
            }
            // Reproducción desde el inicio (no es un salto): sin seek pendiente.
            pendingSeek = null
            // Durante el conteo, precargamos el iframe si aún no existe.
            if (!ytPlayerReady) controlYoutube(true)
            const go = await runCountdown()
            if (!go) return
            setPlaying(true)
        }

        playButton?.addEventListener("click", startWithCountdown)

        // Botón "volver al inicio": reinicia el timeline y el video desde cero.
        const replayButton = document.getElementById("timeline-replay")
        const replaySong = async () => {
            stopCountdown()
            pendingSeek = null
            // Si está sonando, detenemos timeline y video para que el conteo
            // respete silencio y la animación no avance durante el 3-2-1.
            stopTimeline()
            countingDown = true
            countdownToken += 1
            if (ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(0, true)
            }
            activeIndex = 0
            renderActive()
            const go = await runCountdown()
            if (!go) return
            setPlaying(true)
        }
        replayButton?.addEventListener("click", replaySong)

        // Click en una tarjeta de sección: salta a esa sección de la línea de
        // tiempo y reproduce la animación y el video desde ahí (con conteo).
        const jumpToSection = async (instance) => {
            if (instance.missing) return
            const targetCell = cells.findIndex((c) => c.sectionIndex === instance.index)
            if (targetCell < 0) return
            stopCountdown()
            stopTimeline()
            countingDown = true
            countdownToken += 1
            activeIndex = targetCell
            renderActive()
            // Segundo del video donde empieza la sección:
            // animationDelay + (beat × bpmTime). Seek ahí para sincronizar.
            const seekSec = animationDelayMs / 1000 + (targetCell * bpmTime / 1000)
            if (ytPlayer && ytPlayerReady) {
                ytPlayer.pauseVideo()
                ytPlayer.seekTo(seekSec, true)
                pendingSeek = null
            } else {
                pendingSeek = seekSec
                controlYoutube(true) // precarga el iframe durante el conteo
            }
            const go = await runCountdown()
            if (!go) return
            // Salto mid-canción: arranca sin volver a aplicar animationDelay.
            setPlaying(true, { skipDelay: true })
        }
        sectionCards.forEach((card) => {
            const instance = sectionInstances.find((i) => String(i.index) === card.dataset.section)
            if (!instance) return
            card.addEventListener("click", () => jumpToSection(instance))
        })

        return
    }

}

renderSongTimeline()
