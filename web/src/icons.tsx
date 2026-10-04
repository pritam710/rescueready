import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const Base = ({ size = 20, children, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
)

export const ShieldIcon = (props: IconProps) => <Base {...props}><path d="M12 3 4.8 6v5.2c0 4.7 3 8.4 7.2 9.8 4.2-1.4 7.2-5.1 7.2-9.8V6L12 3Z"/><path d="m8.7 12.2 2.1 2.1 4.7-5"/></Base>
export const HomeIcon = (props: IconProps) => <Base {...props}><path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6"/></Base>
export const BoxIcon = (props: IconProps) => <Base {...props}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></Base>
export const DrillIcon = (props: IconProps) => <Base {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></Base>
export const MessageIcon = (props: IconProps) => <Base {...props}><path d="M20 15a3 3 0 0 1-3 3H8l-4 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z"/></Base>
export const MicIcon = (props: IconProps) => <Base {...props}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></Base>
export const SendIcon = (props: IconProps) => <Base {...props}><path d="m21 3-7.8 18-2.5-7.7L3 10.8 21 3Z"/><path d="m10.7 13.3 4-4"/></Base>
export const BellIcon = (props: IconProps) => <Base {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></Base>
export const UserIcon = (props: IconProps) => <Base {...props}><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></Base>
export const CloudIcon = (props: IconProps) => <Base {...props}><path d="M6 19h11a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.3 9.5 4.8 4.8 0 0 0 6 19Z"/></Base>
export const CheckIcon = (props: IconProps) => <Base {...props}><path d="m5 12 4 4L19 6"/></Base>
export const ArrowIcon = (props: IconProps) => <Base {...props}><path d="M5 12h14M14 7l5 5-5 5"/></Base>
export const SparkIcon = (props: IconProps) => <Base {...props}><path d="m12 3 1.2 4.4L17 9l-3.8 1.6L12 15l-1.2-4.4L7 9l3.8-1.6L12 3Z"/><path d="m5 15 .6 2.2L8 18l-2.4.8L5 21l-.6-2.2L2 18l2.4-.8L5 15ZM19 12l.6 2.2 2.4.8-2.4.8L19 18l-.6-2.2L16 15l2.4-.8L19 12Z"/></Base>
export const CloseIcon = (props: IconProps) => <Base {...props}><path d="m6 6 12 12M18 6 6 18"/></Base>
export const PlayIcon = (props: IconProps) => <Base {...props}><path d="m8 5 11 7-11 7V5Z"/></Base>
export const PauseIcon = (props: IconProps) => <Base {...props}><path d="M8 5v14M16 5v14"/></Base>
export const PetIcon = (props: IconProps) => <Base {...props}><circle cx="12" cy="14" r="4"/><circle cx="5.5" cy="10" r="2"/><circle cx="18.5" cy="10" r="2"/><circle cx="8" cy="5.5" r="2"/><circle cx="16" cy="5.5" r="2"/></Base>
export const MoreIcon = (props: IconProps) => <Base {...props}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></Base>
