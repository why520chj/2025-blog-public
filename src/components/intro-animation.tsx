'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

/**
 * 进入动画：图标从屏幕外左侧旋转飞入屏幕中央，停留后整层淡出。
 * 放在 root layout，因此只在硬刷新/首次加载时播放一次（客户端路由切换不重播）。
 * 尊重系统「减弱动态」偏好：开启时直接跳过动画。
 */
export default function IntroAnimation() {
	const [show, setShow] = useState(true)

	useEffect(() => {
		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		if (reduceMotion) {
			setShow(false)
			return
		}
		// 图标进入 ~1.1s，停留后于 2.2s 触发遮罩淡出（exit 0.5s）
		const timer = window.setTimeout(() => setShow(false), 2200)
		return () => window.clearTimeout(timer)
	}, [])

	return (
		<AnimatePresence>
			{show && (
				<motion.div
					className='fixed inset-0 z-[100] flex items-center justify-center bg-white'
					initial={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5, ease: 'easeInOut' }}
				>
					<motion.img
						src='/images/avatar.png'
						alt='logo'
						width={112}
						height={112}
						className='rounded-3xl shadow-2xl'
						initial={{ x: '-120vw', rotate: -540, opacity: 0, scale: 0.5 }}
						animate={{ x: 0, rotate: 0, opacity: 1, scale: 1 }}
						transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 1 }}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
