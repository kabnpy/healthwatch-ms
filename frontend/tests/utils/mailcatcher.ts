import type { APIRequestContext } from "@playwright/test"

type Email = {
  id: string | number
  recipients: string[]
  subject: string
  html?: string
  text?: string
}

async function findEmail({
  request,
  filter,
}: {
  request: APIRequestContext
  filter?: (email: Email) => boolean
}) {
  const host = process.env.MAILCATCHER_HOST || "http://localhost:1080"
  let emails: Email[] = []

  // Try modern Mailpit API first
  try {
    const response = await request.get(`${host}/api/v1/messages`)
    if (response.ok()) {
      const data = await response.json()
      if (data && Array.isArray(data.messages)) {
        emails = data.messages.map((m: any) => ({
          id: m.ID,
          recipients: (m.To || []).map((t: any) => `<${t.Address}>`),
          subject: m.Subject,
        }))
      }
    }
  } catch {
    // Fall back to legacy mailcatcher below
  }

  // Fallback to legacy mailcatcher endpoint
  if (emails.length === 0) {
    try {
      const response = await request.get(`${host}/messages`)
      if (response.ok()) {
        emails = await response.json()
      }
    } catch {
      return null
    }
  }

  if (filter) {
    emails = emails.filter(filter)
  }

  const email = emails[emails.length - 1]
  if (!email) return null

  // Fetch full message details from Mailpit to include HTML body
  try {
    const detailRes = await request.get(`${host}/api/v1/message/${email.id}`)
    if (detailRes.ok()) {
      const detail = await detailRes.json()
      return {
        ...email,
        html: detail.HTML || "",
        text: detail.Text || "",
      }
    }
  } catch {
    // Return standard email object if detail fetch fails
  }

  return email
}

export function findLastEmail({
  request,
  filter,
  timeout = 5000,
}: {
  request: APIRequestContext
  filter?: (email: Email) => boolean
  timeout?: number
}) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Timeout while trying to get latest email")),
      timeout,
    ),
  )

  const checkEmails = async () => {
    while (true) {
      const emailData = await findEmail({ request, filter })

      if (emailData) {
        return emailData
      }
      // Wait for 100ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return Promise.race([timeoutPromise, checkEmails()])
}
