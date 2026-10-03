import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The proxies are H.264, so the default (fast) OffthreadVideo path works.
Config.setChromiumOpenGlRenderer('angle');
