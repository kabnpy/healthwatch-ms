import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Trash2 } from "lucide-react"
import { ClientsService } from "@/client"
import { ClientForm } from "@/components/Clients/ClientForm"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useCustomToast from "@/hooks/useCustomToast"
import { useDeleteClient, useUpdateClient } from "@/hooks/useInsurance"
import { handleError } from "@/utils"

function getClientQueryOptions(clientId: string) {
  return {
    queryFn: async () =>
      (await ClientsService.readClient({ path: { id: clientId } })).data,
    queryKey: ["clients", clientId],
  }
}

export const Route = createFileRoute("/_layout/clients/$clientId/settings")({
  component: ClientSettings,
})

function ClientSettings() {
  const { clientId } = Route.useParams()
  const { data: client } = useSuspenseQuery(getClientQueryOptions(clientId))
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()
  const navigate = useNavigate()

  const handleUpdate = (data: any) => {
    updateClient.mutate(
      { id: clientId, data },
      {
        onSuccess: () => {
          showSuccessToast("Client updated successfully")
        },
        onError: (err: any) => {
          handleError.call(showErrorToast, err)
        },
      },
    )
  }

  const handleDelete = () => {
    deleteClient.mutate(clientId, {
      onSuccess: () => {
        showSuccessToast("Client deleted successfully")
        navigate({ to: "/clients" })
      },
      onError: (err: any) => {
        handleError.call(showErrorToast, err)
      },
    })
  }

  return (
    <div className="space-y-6 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Edit Client Information</CardTitle>
          <CardDescription>
            Update the basic contact and identification details for this client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm
            initialData={client}
            onSubmit={handleUpdate}
            isLoading={updateClient.isPending}
            submitLabel="Update Client Details"
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions related to this client record.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between py-6">
          <div className="space-y-1">
            <p className="font-bold text-sm">Delete Client Account</p>
            <p className="text-xs text-muted-foreground">
              Once you delete a client, all associated data (policies, risk
              notes) may become orphaned. This action is permanent.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="size-4" />
                Delete Client
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{client.name}</strong>{" "}
                  and all associated records from the servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
