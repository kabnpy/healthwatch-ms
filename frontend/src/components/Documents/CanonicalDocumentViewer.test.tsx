// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { client } from "@/client"
import { CanonicalDocumentViewer } from "./CanonicalDocumentViewer"

vi.mock("@/client", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe("CanonicalDocumentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("loads HTML preview via generated client.get without raw fetch or localStorage token reads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem")

    vi.mocked(client.get).mockResolvedValueOnce({
      data: "<html><body><h1>Risk Note Preview</h1></body></html>",
    } as any)

    render(
      <CanonicalDocumentViewer
        resourceType="risk_note"
        resourceId="rn-1"
        title="Risk Note"
      />,
    )

    await waitFor(() => {
      const iframe = document.querySelector("iframe")
      expect(iframe?.getAttribute("srcdoc")).toContain("Risk Note Preview")
    })

    expect(client.get).toHaveBeenCalledWith({
      url: "/api/v1/document-jobs/preview/html",
      query: {
        resource_type: "risk_note",
        resource_id: "rn-1",
      },
      responseType: "text",
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getItemSpy).not.toHaveBeenCalledWith("access_token")

    fetchSpy.mockRestore()
    getItemSpy.mockRestore()
  })

  it("loads draft HTML preview via generated client.post when draftSnapshot is provided", async () => {
    vi.mocked(client.post).mockResolvedValueOnce({
      data: "<html><body><h1>Draft Preview</h1></body></html>",
    } as any)

    render(
      <CanonicalDocumentViewer
        resourceType="risk_note"
        resourceId="rn-1"
        draftSnapshot={{ include_digital_stamp: false }}
        title="Draft Risk Note"
      />,
    )

    await waitFor(() => {
      const iframe = document.querySelector("iframe")
      expect(iframe?.getAttribute("srcdoc")).toContain("Draft Preview")
    })

    expect(client.post).toHaveBeenCalledWith({
      url: "/api/v1/document-jobs/preview/html",
      body: {
        resource_type: "risk_note",
        resource_id: "rn-1",
        snapshot_data: { include_digital_stamp: false },
      },
      headers: {
        "Content-Type": "application/json",
      },
      responseType: "text",
    })
  })
})
