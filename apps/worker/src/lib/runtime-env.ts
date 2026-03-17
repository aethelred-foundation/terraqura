export type KycProvider = "sumsub" | "onfido" | "disabled";

export interface WorkerRuntimeEnv {
  KYC_PROVIDER: KycProvider;
  SUMSUB_APP_TOKEN?: string;
  SUMSUB_SECRET_KEY?: string;
  ONFIDO_API_TOKEN?: string;
}

let cachedEnv: WorkerRuntimeEnv | null = null;

function readKycProvider(): KycProvider {
  const rawProvider = (process.env.KYC_PROVIDER || "sumsub").trim().toLowerCase();
  if (
    rawProvider !== "sumsub" &&
    rawProvider !== "onfido" &&
    rawProvider !== "disabled"
  ) {
    throw new Error(
      `KYC_PROVIDER must be one of: sumsub, onfido, disabled (received: ${rawProvider || "<empty>"})`
    );
  }

  return rawProvider;
}

export function getWorkerRuntimeEnv(): WorkerRuntimeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const kycProvider = readKycProvider();
  const sumsubAppToken = process.env.SUMSUB_APP_TOKEN;
  const sumsubSecretKey = process.env.SUMSUB_SECRET_KEY;
  const onfidoApiToken = process.env.ONFIDO_API_TOKEN;

  if (kycProvider === "sumsub" && (!sumsubAppToken || !sumsubSecretKey)) {
    throw new Error(
      "SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be configured when KYC_PROVIDER=sumsub"
    );
  }

  if (kycProvider === "onfido" && !onfidoApiToken) {
    throw new Error("ONFIDO_API_TOKEN must be configured when KYC_PROVIDER=onfido");
  }

  cachedEnv = {
    KYC_PROVIDER: kycProvider,
    SUMSUB_APP_TOKEN: sumsubAppToken,
    SUMSUB_SECRET_KEY: sumsubSecretKey,
    ONFIDO_API_TOKEN: onfidoApiToken,
  };

  return cachedEnv;
}
