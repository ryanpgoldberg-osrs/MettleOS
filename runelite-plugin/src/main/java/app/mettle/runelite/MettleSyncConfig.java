package app.mettle.runelite;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

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
        return System.getProperty("user.home") + "/Mettle Sync";
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
