## このリポジトリについて（sample-edge-auth）

AWS Cognito + CloudFront + Lambda@Edge（cognito-at-edge）で、認証付きの静的 Web 配信を行うサンプルです。
Viewer Request の Lambda@Edge が未認証ユーザーを Cognito Hosted UI にリダイレクトし、認証後は Cookie でトークンを管理します。

このファイルは、Copilot がコード修正/追加を行う際に「どこを触るべきか」「何が前提か」「どうビルド/デプロイするか」を迷わないための指針です。

---

## ディレクトリの役割

- `cdk/`

  - AWS リソース一式を定義する CDK (TypeScript) プロジェクト。
  - Cognito User Pool / App Client / Domain、S3（静的ホスティング）、CloudFront、Lambda@Edge、SSM Parameter、フロント配布（S3 デプロイ）をまとめて構築します。
  - 主要ファイル:
    - `cdk/bin/app.ts`: CDK エントリ
    - `cdk/lib/sample-edge-auth-stack.ts`: メインスタック

- `lambda/auth/`

  - Lambda@Edge（Viewer Request）で実行される認証ハンドラ。
  - `cognito-at-edge` と `@aws-sdk/client-ssm` を使用し、SSM から Cognito 設定を読み込み、`Authenticator#handle` に委譲します。
  - 主要ファイル:
    - `lambda/auth/index.ts`: Lambda@Edge ハンドラ本体

- `frontend/`

  - Vue 3 + Vite + TypeScript のフロントエンド。
  - ビルド成果物は `frontend/dist/` に出力され、CDK が S3 にアップロードします。
  - 主要ファイル:
    - `frontend/src/App.vue`: 表示（ログイン成功メッセージ）
    - `frontend/vite.config.ts`: ビルド設定（`dist` 出力）

- `spec.md`

  - 仕様（アーキテクチャ、セキュリティ、制約など）。

- `task.md`
  - 実装タスク/手順のチェックリスト。

---

## 技術スタック

- IaC: AWS CDK v2 (TypeScript)
- 認証: Amazon Cognito + `cognito-at-edge`
- Edge: AWS Lambda@Edge（Viewer Request、Node.js 20.x）
- CDN/配信: CloudFront + S3（OAC 経由）
- 設定管理: AWS Systems Manager Parameter Store (SSM)
- フロント: Vue 3 + Vite + TypeScript
- バンドル: CDK の bundling で `esbuild` により `lambda/auth/index.ts` を単一 JS にバンドル

---

## 重要な前提（リージョン/SSM）

- Lambda@Edge 関数は AWS 制約により `us-east-1` に作成されます（CDK の `cloudfront.experimental.EdgeFunction` が処理）。
- `lambda/auth/index.ts` の SSM クライアントは `ap-northeast-1` を明示指定しています。
  - したがって、SSM パラメータ（`/sample-edge-auth/*`）は `ap-northeast-1` に存在する前提です。
  - CDK スタックのデプロイ先リージョン（`CDK_DEFAULT_REGION`）を `ap-northeast-1` にする運用が前提になります。
- もし SSM を `us-east-1` に寄せたい/可変にしたい場合は、Lambda@Edge 側の SSM リージョン指定と CDK 側のパラメータ作成先をセットで変更してください（片側だけ変えると取得に失敗します）。

---

## ビルド/実行（ローカル）

### 前提

- Node.js（推奨: 20 系）
- AWS CLI 認証済み（`AWS_PROFILE` など）
- CDK v2 利用（`cdk/` の依存に含まれます）

### frontend

```powershell
cd frontend
npm ci
npm run dev      # 開発サーバ
# または
npm run build    # dist 出力
npm run preview  # dist のローカル確認
```

### lambda/auth

```powershell
cd lambda/auth
npm ci
npm run build
```

補足:

- 実デプロイ時は CDK の bundling が `lambda/auth/index.ts` を `esbuild` でバンドルします。
- ただし `npm ci` / `npm run build` を通しておくと型エラーを早期に検出できます。

### cdk

```powershell
cd cdk
npm ci
npm run build
```

---

## デプロイ手順（CDK）

### 1) CDK Bootstrap

Lambda@Edge とデプロイ先リージョンの両方で bootstrap が必要です。

```powershell
# us-east-1（Lambda@Edge 用）
cd cdk
cdk bootstrap aws://<ACCOUNT_ID>/us-east-1

# ap-northeast-1（メインスタック想定。SSM パラメータ前提）
cdk bootstrap aws://<ACCOUNT_ID>/ap-northeast-1
```

### 2) フロントをビルド

```powershell
cd frontend
npm ci
npm run build
```

### 3) デプロイ

`CDK_DEFAULT_REGION=ap-northeast-1` の状態でデプロイすることを前提にします。

```powershell
cd cdk
npm ci
npm run build
cdk deploy --all
```

補足:

- 初回は CloudFront ドメイン確定後に Cognito の callback/logout URL が決まるため、状況により再デプロイが必要になることがあります（`task.md` の備考参照）。
- デプロイ完了後、出力される CloudFront URL にアクセスして Hosted UI へ遷移することを確認します。

---

## 変更時のガイド（Copilot 向け）

- 変更は最小限にし、既存の構成（CDK で一括構築、フロントは `dist` を CDK が配布、認証は Lambda@Edge）を崩さない。
- 認証フロー/クッキー挙動を変える場合は、`lambda/auth/index.ts` の `Authenticator` 設定（`cookieExpirationDays`, `httpOnly`, `sameSite`, `logLevel` など）を中心に確認する。
- リージョンや SSM パラメータの扱いを変えるときは「Lambda@Edge 側の取得リージョン」「CDK 側の作成リージョン」「IAM の SSM 参照 ARN」を必ず整合させる。
- ビルド成果物の取り扱いは以下を前提にする:
  - フロント: `frontend/dist` を CDK が S3 にデプロイ
  - Edge: CDK bundling により `lambda/auth/index.ts` をバンドルしてデプロイ
