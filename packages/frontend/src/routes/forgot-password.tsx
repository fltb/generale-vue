import type { ErrorResp, MessageResp, RequestPasswordResetReqBody } from "@generale/types/dist/api";
import { Title, Meta } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { useMutation } from "@tanstack/solid-query";
import { createSignal, Show } from "solid-js";
import { useT } from "../i18n/useT";
import { forgotPasswordApi } from "~/api/accountApi";
import type { ApiError } from "~/api/base";
import { Button, Input, Alert } from "~/ui";

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const { t } = useT();
  const [email, setEmail] = createSignal("");

  const mutation = useMutation<MessageResp, ApiError<ErrorResp>, RequestPasswordResetReqBody>(() => ({
    mutationFn: (body) => forgotPasswordApi(body),
  }));

  function submit(e: Event) {
    e.preventDefault();
    if (!email().trim()) return;
    mutation.mutate({ email: email().trim() });
  }

  return (
    <div class="p-4 max-w-md mx-auto">
      <Title>
        {t("Forgot Password")} — {t("General E")}
      </Title>
      <Meta name="description" content={t("Reset your password.")} />
      <Meta property="og:title" content={`${t("Forgot Password")} — ${t("General E")}`} />
      <Meta property="og:description" content={t("Reset your password.")} />
      <Meta property="og:image" content="/og-image.svg" />
      <Meta property="og:type" content="website" />
      <h1 class="text-2xl mb-4">{t("Reset your password")}</h1>

      <Show
        when={!mutation.isSuccess}
        fallback={
          <div class="space-y-4">
            <Alert variant="success">{mutation.data?.message ?? t("Reset link sent")}</Alert>
            <p class="text-sm opacity-70">
              {t(
                "Check your email (including spam) and click the link to set a new password. The link expires in 10 minutes.",
              )}
            </p>
            <div class="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => nav("/login")}>
                {t("Back to login")}
              </Button>
            </div>
          </div>
        }
      >
        <form class="flex flex-col gap-2" onSubmit={submit}>
          <p class="text-sm opacity-70">{t("Enter the email you registered with and we'll send a reset link.")}</p>
          <Input
            type="email"
            bordered
            placeholder={t("Email")}
            value={email()}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            required
          />
          <Button variant="primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("Sending...") : t("Send reset link")}
          </Button>
          <Show when={mutation.isError}>
            <p class="text-error text-sm">{mutation.error?.message ?? t("Sending failed")}</p>
          </Show>
          <p class="mt-2 text-sm">
            <A href="/login" class="link">
              {t("Back to login")}
            </A>
          </p>
        </form>
      </Show>
    </div>
  );
}
