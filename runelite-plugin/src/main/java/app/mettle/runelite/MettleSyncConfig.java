package app.mettle.runelite;

import java.io.File;
import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;
import net.runelite.client.RuneLite;

@ConfigGroup("mettlesync")
public interface MettleSyncConfig extends Config
{
    @ConfigItem(
        keyName = "exportDirectory",
        name = "Export directory",
        description = "Directory used for exported Mettle sync snapshots",
        position = 1
    )
    default String exportDirectory()
    {
        return new File(RuneLite.RUNELITE_DIR, "Mettle Sync").getPath();
    }

    @ConfigItem(
        keyName = "exportOnLogin",
        name = "Export on login",
        description = "Write a fresh sync file when the plugin sees a logged-in account",
        position = 2
    )
    default boolean exportOnLogin()
    {
        return false;
    }
}
