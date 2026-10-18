package com.example.ben

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import android.widget.ImageView
import java.io.BufferedInputStream
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.zip.GZIPInputStream

object ImageLoader {
    private val memoryCache: LruCache<String, Bitmap>
    private val executor = Executors.newFixedThreadPool(4)
    private val preloadExecutor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        val maxMemory = (Runtime.getRuntime().maxMemory() / 1024).toInt()
        val cacheSize = maxMemory / 6 // Devote ~16% of heap to fast image caching
        memoryCache = object : LruCache<String, Bitmap>(cacheSize) {
            override fun sizeOf(key: String, bitmap: Bitmap): Int {
                return bitmap.byteCount / 1024
            }
        }
    }

    /**
     * Instantly load from memory cache, or fetch asynchronously with decoded sampling
     */
    fun load(url: String?, imageView: ImageView, placeholderResId: Int = R.drawable.ic_spotify_logo) {
        if (url.isNullOrBlank()) {
            imageView.setImageResource(placeholderResId)
            imageView.tag = null
            return
        }

        val cached = memoryCache.get(url)
        if (cached != null) {
            imageView.setImageBitmap(cached)
            imageView.tag = url
            return
        }

        imageView.setImageResource(placeholderResId)
        imageView.tag = url

        executor.execute {
            val bitmap = fetchAndDecodeBitmap(url, targetSize = 300)
            if (bitmap != null) {
                memoryCache.put(url, bitmap)
                mainHandler.post {
                    if (imageView.tag == url) {
                        imageView.setImageBitmap(bitmap)
                    }
                }
            }
        }
    }

    /**
     * Preload high-priority image URLs in the background to memory cache for 0ms render
     */
    fun preload(urls: List<String?>) {
        preloadExecutor.execute {
            urls.filterNotNull().filter { it.isNotBlank() }.forEach { url ->
                if (memoryCache.get(url) == null) {
                    val bitmap = fetchAndDecodeBitmap(url, targetSize = 300)
                    if (bitmap != null) {
                        memoryCache.put(url, bitmap)
                    }
                }
            }
        }
    }

    private fun fetchAndDecodeBitmap(urlStr: String, targetSize: Int): Bitmap? {
        var conn: HttpURLConnection? = null
        try {
            conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.connectTimeout = 3000
            conn.readTimeout = 3000
            conn.useCaches = true
            conn.setRequestProperty("User-Agent", "PMusic/1.0 (Android)")
            conn.setRequestProperty("Accept-Encoding", "gzip")
            conn.doInput = true
            conn.connect()

            val encoding = conn.contentEncoding
            val rawStream = if (encoding != null && encoding.equals("gzip", ignoreCase = true)) {
                GZIPInputStream(conn.inputStream)
            } else {
                conn.inputStream
            }

            val buffer = ByteArrayOutputStream()
            val data = ByteArray(4096)
            var nRead: Int
            BufferedInputStream(rawStream).use { bis ->
                while (bis.read(data, 0, data.size).also { nRead = it } != -1) {
                    buffer.write(data, 0, nRead)
                }
            }
            val bytes = buffer.toByteArray()
            if (bytes.isEmpty()) return null

            // Decode image bounds first to compute inSampleSize
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)

            // Compute optimal sub-sampling factor
            var sampleSize = 1
            if (options.outHeight > targetSize || options.outWidth > targetSize) {
                val halfHeight = options.outHeight / 2
                val halfWidth = options.outWidth / 2
                while (halfHeight / sampleSize >= targetSize && halfWidth / sampleSize >= targetSize) {
                    sampleSize *= 2
                }
            }

            // Decode actual bitmap using RGB_565 (2x faster, 50% less RAM)
            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.RGB_565
                inDither = true
            }

            return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOptions)
        } catch (_: Exception) {
            return null
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }
}
