import Head from 'next/head'
import RickChatbot from '../components/RickChatbot'

export default function Home() {
  return (
    <>
      <Head>
        <title>Rick Sanchez AI Chatbot</title>
        <meta name="description" content="Talk to Rick from Rick and Morty!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <RickChatbot />
    </>
  )
}