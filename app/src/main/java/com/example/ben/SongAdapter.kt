package com.example.ben

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.example.ben.databinding.ItemSongRowBinding

class SongAdapter(
    private var songs: List<Song>,
    private val onSongClick: (Song, Int) -> Unit,
    private val onLikeClick: (Song) -> Unit,
    private val onMoreClick: ((Song) -> Unit)? = null,
) : RecyclerView.Adapter<SongAdapter.SongViewHolder>() {

    init {
        setHasStableIds(true)
    }

    override fun getItemId(position: Int): Long {
        return songs[position].id.hashCode().toLong()
    }

    class SongViewHolder(val binding: ItemSongRowBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SongViewHolder {
        val binding = ItemSongRowBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return SongViewHolder(binding)
    }

    override fun onBindViewHolder(holder: SongViewHolder, position: Int) {
        val song = songs[position]
        val context = holder.itemView.context

        holder.binding.tvSongTitle.text = song.title
        holder.binding.tvSongArtist.text = song.artist
        holder.binding.tvDuration.text = song.durationFormatted

        // Load album artwork
        ImageLoader.load(song.artworkUrl, holder.binding.imgSongThumb)

        // Highlight if currently playing
        val isCurrent = PlaybackManager.currentSong?.id == song.id
        holder.binding.tvSongTitle.setTextColor(if (isCurrent) ContextCompat.getColor(context, R.color.spotify_green) else ContextCompat.getColor(context, R.color.spotify_white))

        // Like button tint
        holder.binding.btnLike.setColorFilter(if (song.isLiked) ContextCompat.getColor(context, R.color.spotify_green) else ContextCompat.getColor(context, R.color.spotify_subdued))

        holder.binding.btnLike.setOnClickListener {
            song.isLiked = !song.isLiked
            notifyItemChanged(position)
            onLikeClick(song)
        }

        // 3-Dots More Context Menu Button
        holder.binding.btnSongMore.setOnClickListener {
            onMoreClick?.invoke(song)
        }

        holder.itemView.setOnClickListener {
            onSongClick(song, position)
            @Suppress("NotifyDataSetChanged")
            notifyDataSetChanged()
        }

        holder.itemView.setOnLongClickListener {
            onMoreClick?.invoke(song)
            true
        }
    }

    override fun getItemCount(): Int = songs.size

    fun updateSongs(newSongs: List<Song>) {
        songs = newSongs
        @Suppress("NotifyDataSetChanged")
        notifyDataSetChanged()
    }
}
