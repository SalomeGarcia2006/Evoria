import { SetMetadata } from '@nestjs/common';

export const DEVELOPER_ONLY_KEY = 'developerOnly';
export const DeveloperOnly = () => SetMetadata(DEVELOPER_ONLY_KEY, true);
