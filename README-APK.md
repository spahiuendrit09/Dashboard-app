# Dashboard als Android-APK (für Obtainium)

Die APK wird kostenlos von GitHub gebaut und als Release abgelegt. Obtainium holt sie dort ab und hält sie aktuell.

## Einmalig einrichten

1. **Capacitor installieren** (im Projektordner):

   npm i @capacitor/core @capacitor/android
   npm i -D @capacitor/cli

2. **Dateien aus diesem Paket kopieren** (vorhandene ersetzen):
   - `capacitor.config.ts` (ändere `appId`, z. B. in `at.deinname.dashboard`, danach nie wieder)
   - `.github/workflows/android.yml`
   - `android-res/` (die App-Icons)
   - `src/pwa.ts`

3. **Android-Projekt erzeugen** (braucht kein Android Studio):

   npm run build
   npx cap add android

   Den entstandenen Ordner `android/` mit ins Git aufnehmen.

4. **Signierschlüssel erzeugen** (einmal, gut aufbewahren: ohne ihn lassen sich Updates nicht über die alte App installieren):

   keytool -genkeypair -v -keystore release.jks -alias dashboard -keyalg RSA -keysize 2048 -validity 10000

   Nimm dasselbe Passwort für Keystore und Schlüssel.

5. **Drei Secrets in GitHub anlegen** (Repository, Settings, Secrets and variables, Actions):
   - `KEYSTORE_BASE64`: der Inhalt von `release.jks` als Base64
     - Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.jks")) | Set-Clipboard`
     - Mac: `base64 -i release.jks | pbcopy`
     - Linux: `base64 -w0 release.jks`
   - `KEYSTORE_PASSWORD`: dein Passwort
   - `KEY_ALIAS`: `dashboard`

## APK bauen

Version festlegen und hochladen:

   git tag v1.0.0
   git push --tags

Unter dem Reiter Actions läuft der Bau (ca. 5 bis 10 Minuten). Danach liegt die APK unter Releases.
Für jedes Update einen neuen Tag verwenden (v1.0.1, v1.1.0, ...).

## Obtainium

1. Obtainium öffnen, Plus, die GitHub-Adresse deines Repositories einfügen, „Hinzufügen".
2. Installieren. Bei neuen Releases bietet Obtainium das Update selbst an.
3. Ist das Repository privat, trägst du in den Obtainium-Einstellungen einen GitHub-Token ein.
