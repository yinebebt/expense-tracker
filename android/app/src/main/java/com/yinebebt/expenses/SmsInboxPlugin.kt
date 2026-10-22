package com.yinebebt.expenses

import android.Manifest
import android.content.Intent
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.provider.Telephony
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

/**
 * Reads bank SMS from the inbox. Only messages from the requested senders are
 * returned, so other SMS never reach the web layer. Permission checks and
 * requests come from the Capacitor base class via the "sms" alias.
 */
@CapacitorPlugin(
    name = "SmsInbox",
    permissions = [Permission(alias = "sms", strings = [Manifest.permission.READ_SMS])],
)
class SmsInboxPlugin : Plugin() {
    private var observer: ContentObserver? = null

    /** Inbox messages from `senders` received at or after `since` (epoch ms), oldest first. */
    @PluginMethod
    fun list(call: PluginCall) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission not granted", "PERMISSION_DENIED")
            return
        }
        val senders = call.getArray("senders")?.toList<String>()?.map(::normalize)?.toSet().orEmpty()
        val since = call.getLong("since") ?: 0L
        val limit = call.getInt("limit") ?: 5000
        val messages = JSArray()

        try {
            context.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(since.toString()),
                "${Telephony.Sms.DATE} ASC",
            )?.use { c ->
                val id = c.getColumnIndexOrThrow(Telephony.Sms._ID)
                val address = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val body = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val date = c.getColumnIndexOrThrow(Telephony.Sms.DATE)
                while (c.moveToNext() && messages.length() < limit) {
                    val from = c.getString(address) ?: continue
                    if (normalize(from) !in senders) continue
                    messages.put(JSObject().apply {
                        put("id", c.getLong(id).toString())
                        put("address", from)
                        put("body", c.getString(body) ?: "")
                        put("date", c.getLong(date))
                    })
                }
            }
        } catch (e: Exception) {
            call.reject("Reading SMS failed", e)
            return
        }
        call.resolve(JSObject().apply { put("messages", messages) })
    }

    /**
     * One inbox message by id, for showing a transaction's original SMS. Resolves with no
     * `message` when it was deleted or isn't from one of `senders`, so only bank SMS ever
     * reach the web layer.
     */
    @PluginMethod
    fun get(call: PluginCall) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission not granted", "PERMISSION_DENIED")
            return
        }
        val senders = call.getArray("senders")?.toList<String>()?.map(::normalize)?.toSet().orEmpty()
        val id = call.getString("id")?.toLongOrNull()
        val result = JSObject()

        try {
            if (id != null) {
                context.contentResolver.query(
                    Telephony.Sms.Inbox.CONTENT_URI,
                    arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                    "${Telephony.Sms._ID} = ?",
                    arrayOf(id.toString()),
                    null,
                )?.use { c ->
                    if (c.moveToFirst()) {
                        val from = c.getString(0)
                        if (from != null && normalize(from) in senders) {
                            result.put("message", JSObject().apply {
                                put("id", id.toString())
                                put("address", from)
                                put("body", c.getString(1) ?: "")
                                put("date", c.getLong(2))
                            })
                        }
                    }
                }
            }
        } catch (e: Exception) {
            call.reject("Reading SMS failed", e)
            return
        }
        call.resolve(result)
    }

    /**
     * Business-looking sender IDs (names or short codes, not phone numbers) received since `since`
     * that aren't in `known`, with message counts. Lets beta testers report banks the app misses.
     * Reads addresses only, never message bodies.
     */
    @PluginMethod
    fun otherSenders(call: PluginCall) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission not granted", "PERMISSION_DENIED")
            return
        }
        val known = call.getArray("known")?.toList<String>()?.map(::normalize)?.toSet().orEmpty()
        val since = call.getLong("since") ?: 0L
        val counts = mutableMapOf<String, Int>()

        try {
            context.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms.ADDRESS),
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(since.toString()),
                null,
            )?.use { c ->
                val address = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                while (c.moveToNext()) {
                    val from = c.getString(address) ?: continue
                    val key = normalize(from)
                    val business = key.any { it.isLetter() } || key.length in 3..6
                    if (business && key !in known) counts[from] = (counts[from] ?: 0) + 1
                }
            }
        } catch (e: Exception) {
            call.reject("Reading SMS failed", e)
            return
        }
        val senders = JSArray()
        counts.entries.sortedByDescending { it.value }.take(40).forEach { (from, n) ->
            senders.put(JSObject().apply {
                put("address", from)
                put("count", n)
            })
        }
        call.resolve(JSObject().apply { put("senders", senders) })
    }

    /** Emits `smsChanged` whenever the SMS store changes, while the app is running. */
    @PluginMethod
    fun startWatching(call: PluginCall) {
        if (observer == null && getPermissionState("sms") == PermissionState.GRANTED) {
            val o = object : ContentObserver(Handler(Looper.getMainLooper())) {
                override fun onChange(selfChange: Boolean) {
                    notifyListeners("smsChanged", JSObject())
                }
            }
            context.contentResolver.registerContentObserver(Telephony.Sms.CONTENT_URI, true, o)
            observer = o
        }
        call.resolve()
    }

    /** Opens this app's system settings page, for when the permission was blocked. */
    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        call.resolve()
    }

    override fun handleOnDestroy() {
        observer?.let { context.contentResolver.unregisterContentObserver(it) }
        observer = null
    }

    // Same rule as normalizeAddress() in sms-parser.ts.
    private fun normalize(address: String) = address.uppercase().replace(Regex("[^A-Z0-9]"), "")
}
