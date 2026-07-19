import { getConversation } from '@/lib/api'
import { Chat } from '@/components/Chat'

export default async function ConversationPage({
  params,
}: {
  params: { id: string }
}) {
  try {
    const conversation = await getConversation(params.id)

    return (
      <div className="results-area" role="main" aria-label="Answers">
        <Chat
          conversationId={params.id}
          initialMessages={conversation.messages || []}
        />
      </div>
    )
  } catch (error) {
    return (
      <div className="results-area" role="main" aria-label="Answers">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Conversation not found</p>
        </div>
      </div>
    )
  }
}
