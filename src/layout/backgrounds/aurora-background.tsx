import { useEffect, useRef } from 'react'
import siteContent from '@/config/site-content.json'
import { makeNoise2D, rand } from './utils'

/**
 * Aurora / Flowing-gradient Background
 * - Several large soft color blobs drift via a Perlin/Simplex flow field
 * - Each blob is a radial gradient (color -> transparent) for an "aurora" look
 * - Designed to sit behind content; a separate blur layer is added in the layout
 */
const FALLBACK_COLORS = ['#8fdbe9', '#f7da39', '#b6a8ff', '#ff9ecd']

export default function AuroraBackground({
	count = 8,
	colors = siteContent.backgroundColors && siteContent.backgroundColors.length ? siteContent.backgroundColors : FALLBACK_COLORS,
	minRadius = 280,
	maxRadius = 560,
	speed = 0.22,
	noiseScale = 0.0006,
	noiseTimeScale = 0.00012,
	targetFps = 30,
	blur = 14,
	startDelayMs = 300,
	regenerateKey = 0
}) {
	const ref = useRef<HTMLCanvasElement>(null)
	const noise = useRef(makeNoise2D())
	const animRef = useRef(0)

	useEffect(() => {
		const canvas = ref.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')!
		let width = 0
		let height = 0
		const DPR = Math.min(2, window.devicePixelRatio || 1)

		const palette = colors && colors.length ? colors : FALLBACK_COLORS

		function resize() {
			width = canvas!.clientWidth
			height = canvas!.clientHeight
			canvas!.width = Math.floor(width * DPR)
			canvas!.height = Math.floor(height * DPR)
			ctx.setTransform(1, 0, 0, 1, 0, 0)
			ctx.scale(DPR, DPR)
		}
		resize()

		let resizeTimer: number | null = null
		const ro = new ResizeObserver(() => {
			if (resizeTimer !== null) window.clearTimeout(resizeTimer)
			resizeTimer = window.setTimeout(() => resize(), 500)
		})
		ro.observe(canvas)

		// Poisson-ish placement to avoid heavy clusters
		const blobs: { x: number; y: number; r: number; color: string; vx: number; vy: number; jitter: number }[] = []
		const minDist = Math.max(minRadius * 0.25, 120)
		let tries = 0
		while (blobs.length < count && tries < 5000) {
			tries++
			const r = rand(minRadius, maxRadius)
			const x = rand(0, Math.max(1, width))
			const y = rand(0, Math.max(1, height))
			let ok = true
			for (const b of blobs) {
				if (Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.5) {
					ok = false
					break
				}
			}
			if (ok) {
				blobs.push({
					x,
					y,
					r,
					color: palette[blobs.length % palette.length],
					vx: 0,
					vy: 0,
					jitter: rand(0.7, 1.3)
				})
			}
		}

		function draw() {
			ctx.clearRect(0, 0, width, height)
			for (const b of blobs) {
				ctx.save()
			ctx.filter = `blur(${blur}px)`
			ctx.globalAlpha = 0.98
				const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
				grad.addColorStop(0, b.color)
				grad.addColorStop(1, 'rgba(0,0,0,0)')
				ctx.fillStyle = grad
				ctx.beginPath()
				ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
				ctx.fill()
				ctx.restore()
			}
		}

		function update(t: number) {
			for (const b of blobs) {
				const n = noise.current(b.x * noiseScale, b.y * noiseScale + t * noiseTimeScale)
				const angle = n * Math.PI * 2
				b.x += Math.cos(angle) * speed * b.jitter
				b.y += Math.sin(angle) * speed * b.jitter
				// Wrap around edges for endless drift
				if (b.x < -b.r) b.x = width + b.r
				if (b.x > width + b.r) b.x = -b.r
				if (b.y < -b.r) b.y = height + b.r
				if (b.y > height + b.r) b.y = -b.r
			}
		}

		const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

		const FRAME = 1000 / targetFps
		let last = 0
		let acc = 0
		function frame(t: number) {
			if (document.hidden) {
				animRef.current = requestAnimationFrame(frame)
				return
			}
			const dt = last ? t - last : 0
			last = t
			acc += dt
			if (acc < FRAME) {
				animRef.current = requestAnimationFrame(frame)
				return
			}
			acc = 0
			update(t)
			draw()
			animRef.current = requestAnimationFrame(frame)
		}

		let timer: number | undefined
		if (reduceMotion) {
			draw()
		} else {
			timer = window.setTimeout(() => {
				animRef.current = requestAnimationFrame(frame)
			}, startDelayMs)
		}

		return () => {
			cancelAnimationFrame(animRef.current)
			if (timer !== undefined) window.clearTimeout(timer)
			ro.disconnect()
			if (resizeTimer !== null) window.clearTimeout(resizeTimer)
		}
	}, [colors, regenerateKey, count, minRadius, maxRadius, speed, noiseScale, noiseTimeScale, targetFps, blur])

	return (
		<div className='fixed inset-0 z-0 overflow-hidden'>
			<canvas ref={ref} className='h-full w-full' style={{ display: 'block' }} />
		</div>
	)
}
