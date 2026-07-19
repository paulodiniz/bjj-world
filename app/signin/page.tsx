import dynamic from 'next/dynamic'

const SignInForm = dynamic(() => import('@/components/SignInForm').then(mod => ({ default: mod.SignInForm })), {
  ssr: false,
  loading: () => <div style={{ minHeight: '100vh' }} />,
})

export default function SignInPage() {
  return <SignInForm />
}
