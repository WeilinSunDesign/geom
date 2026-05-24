import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

const app = express()
app.use(express.json())

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.post('/api/messages', async (req, res) => {
  try {
    const { model, max_tokens, system, messages } = req.body
    const response = await client.messages.create({ model, max_tokens, system, messages })
    res.json(response)
  } catch (err) {
    res.status(500).json({ error: { message: err.message } })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
