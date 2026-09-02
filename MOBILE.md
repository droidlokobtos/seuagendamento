# Aplicativo mobile com Capacitor

O SaaS usa TanStack Start com SSR e funções de servidor no Lovable/Cloudflare. O aplicativo nativo carrega a URL publicada por HTTPS e preserva APIs, autenticação e regras de negócio. `capacitor-web` é a contingência local exigida pelo Capacitor.

## Identificação configurável

Padrões: nome `SeuAgendamento`, App/Bundle ID `com.seuagendamento.app` e URL `https://seuagendamento.lovable.app`. Antes de criar as plataformas, podem ser definidos `CAPACITOR_APP_ID`, `CAPACITOR_APP_NAME` e `CAPACITOR_SERVER_URL`.

Escolha o App/Bundle ID definitivo antes de executar `mobile:add:android` ou `mobile:add:ios`.
Depois que as plataformas forem criadas, uma alteração do identificador também precisa ser
replicada nos projetos nativos.

## Android

```bash
npm install
npm run mobile:add:android
npm run mobile:sync
npm run mobile:open:android
```

No Android Studio, use **Build > Build Bundle(s) / APK(s) > Build APK(s)** para APK de teste ou **Build > Generate Signed Bundle / APK > Android App Bundle** para AAB assinado.

Para gerar pelo terminal, depois de criar e sincronizar a plataforma:

```bash
cd android
./gradlew assembleDebug
./gradlew bundleRelease
```

O APK de teste ficará em `android/app/build/outputs/apk/debug/app-debug.apk`. O AAB ficará em
`android/app/build/outputs/bundle/release/app-release.aab` após configurar a assinatura de
produção.

## iOS

Em macOS com Xcode: `npm run mobile:add:ios`, `npm run mobile:sync` e `npm run mobile:open:ios`. No Xcode, configure Team, Signing, Bundle Identifier, ícones, permissões e certificados; depois gere o Archive para App Store Connect.

## Ícone e splash

Os SVGs em `resources` são modelos. Exporte os arquivos finais `icon-only.png` (1024 × 1024)
e `splash.png` (2732 × 2732) nessa mesma pasta e execute `npm run mobile:assets` depois que
as plataformas nativas forem criadas.
